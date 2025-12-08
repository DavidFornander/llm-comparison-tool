import { NextRequest, NextResponse } from 'next/server';
import { providerRegistry } from '@/lib/provider-registry';
import { rateLimiter } from '@/lib/security/rate-limiter';
import { validatePrompt, validateProviderIds, validateRequestSize, sanitizeError } from '@/lib/security/validator';
import { validateCsrfToken, validateOrigin } from '@/lib/security/csrf';
import { logRateLimitExceeded, logCsrfFailure, logInvalidInput, logApiKeyUsage, logSuspiciousActivity, logProviderError } from '@/lib/security/audit-logger';
import { ipFilter, getClientIP } from '@/lib/security/ip-filter';
import { sanitizeLlmResponse, detectMaliciousPatterns } from '@/lib/security/content-filter';
import config from '@/lib/config';
import type { ChatRequest, ChatResponse, ProviderId } from '@/types';
import { createModeratorPrompt } from '@/lib/utils/moderator';

// Increase timeout for chat API (10 minutes = 600 seconds)
export const maxDuration = 600;

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || undefined;
  const path = request.nextUrl.pathname;

  try {
    // CSRF Protection
    if (!validateCsrfToken(request)) {
      logCsrfFailure(clientIP, path, userAgent);
      ipFilter.recordViolation(clientIP, 'CSRF failure');
      return NextResponse.json(
        { 
          error: 'CSRF token validation failed. This usually happens when the page session has expired or the security token is missing. Please refresh the page and try again.' 
        },
        { status: 403 }
      );
    }

    // Origin validation
    if (!validateOrigin(request, config.security.allowedOrigins)) {
      const origin = request.headers.get('origin') || request.headers.get('referer') || 'unknown';
      logSuspiciousActivity(clientIP, 'Invalid origin', path, userAgent);
      ipFilter.recordViolation(clientIP, 'Invalid origin');
      
      // Provide a more helpful error message
      const isDevelopment = config.nodeEnv === 'development';
      const errorMessage = isDevelopment
        ? `Request origin validation failed. The request is coming from "${origin}", but only these origins are allowed: ${config.security.allowedOrigins.join(', ')}. Please ensure you're accessing the app from an allowed URL, or add your origin to the ALLOWED_ORIGINS environment variable.`
        : 'Request origin validation failed. Please ensure you\'re accessing the application from the correct URL. If you\'re a developer, check your ALLOWED_ORIGINS configuration.';
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 403 }
      );
    }

    // Rate limiting
    const rateLimitResult = rateLimiter.check(clientIP);

    if (!rateLimitResult.allowed) {
      logRateLimitExceeded(clientIP, path, userAgent);
      ipFilter.recordViolation(clientIP, 'Rate limit exceeded');
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please try again later.',
          rateLimit: {
            remaining: rateLimitResult.remaining,
            resetTime: rateLimitResult.resetTime,
          }
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': config.rateLimit.maxRequests.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          }
        }
      );
    }

    // Validate request size
    const contentLength = request.headers.get('content-length');
    if (contentLength) {
      validateRequestSize(parseInt(contentLength, 10));
    }

    // Parse and validate request body
    let body: ChatRequest & { apiKeys: Record<ProviderId, string> };
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { prompt, providerIds, apiKeys, selectedModels, moderator } = body;

    // Validate prompt
    let validatedPrompt: string;
    try {
      validatedPrompt = validatePrompt(prompt);

      // Check for malicious patterns
      const maliciousCheck = detectMaliciousPatterns(validatedPrompt);
      if (maliciousCheck.isMalicious) {
        logSuspiciousActivity(clientIP, `Malicious patterns detected: ${maliciousCheck.patterns.join(', ')}`, path, userAgent);
        ipFilter.recordViolation(clientIP, 'Malicious content detected');
        return NextResponse.json(
          { error: 'Invalid input detected' },
          { status: 400 }
        );
      }
    } catch (error) {
      logInvalidInput(clientIP, path, sanitizeError(error), userAgent);
      return NextResponse.json(
        { error: sanitizeError(error) },
        { status: 400 }
      );
    }

    // Validate provider IDs
    let validatedProviderIds: string[];
    try {
      validatedProviderIds = validateProviderIds(providerIds);
    } catch (error) {
      return NextResponse.json(
        { error: sanitizeError(error) },
        { status: 400 }
      );
    }

    // Collect API keys (prefer server-side, fallback to client-provided)
    const finalApiKeys: Record<ProviderId, string> = {} as Record<ProviderId, string>;
    const missingKeys: ProviderId[] = [];

    for (const providerId of validatedProviderIds as ProviderId[]) {
      const provider = providerRegistry.get(providerId);
      const requiresKey = provider?.requiresApiKey ?? true;
      
      // Check server-side keys first
      const serverKey = config.apiKeys[providerId];
      if (serverKey) {
        finalApiKeys[providerId] = serverKey;
      } else if (apiKeys?.[providerId] && apiKeys[providerId].trim().length > 0) {
        // Fallback to client-provided key
        finalApiKeys[providerId] = apiKeys[providerId];
      } else if (!requiresKey) {
        // Provider doesn't require API key (e.g., local Ollama)
        finalApiKeys[providerId] = ''; // Use empty string
      } else {
        missingKeys.push(providerId);
      }
    }

    if (missingKeys.length > 0) {
      return NextResponse.json(
        {
          error: 'Missing API keys for selected providers',
          missingKeys
        },
        { status: 400 }
      );
    }

    // Make parallel requests to all selected providers
    const promises = validatedProviderIds.map(async (providerId): Promise<ChatResponse> => {
      try {
        const provider = providerRegistry.get(providerId as ProviderId);
        if (!provider) {
          return {
            providerId: providerId as ProviderId,
            content: '',
            error: 'Provider not found',
          };
        }

        const apiKey = finalApiKeys[providerId as ProviderId];
        const model = selectedModels?.[providerId as ProviderId];
        console.log(`[API] Provider: ${providerId}, Selected model: ${model || 'none (will use default)'}`);
        const options = model ? { model } : undefined;
        const rawContent = await provider.generateResponse(validatedPrompt, apiKey, options);

        // Sanitize LLM response to prevent XSS
        const sanitizedContent = sanitizeLlmResponse(rawContent);

        // Log successful API key usage
        logApiKeyUsage(clientIP, providerId, true, userAgent);

        return {
          providerId: providerId as ProviderId,
          content: sanitizedContent,
          model: model || undefined,
        };
      } catch (error) {
        const model = selectedModels?.[providerId as ProviderId];
        
        // Enhanced error logging with context
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorDetails = {
          providerId,
          model: model || 'default',
          promptLength: validatedPrompt.length,
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          errorMessage,
        };
        
        console.error(`[${providerId}] Error generating response:`, {
          ...errorDetails,
          stack: error instanceof Error ? error.stack : undefined,
          technicalDetails: (error as Error & { technicalDetails?: string })?.technicalDetails,
        });
        
        // Log provider error with audit logger
        logProviderError(clientIP, providerId, error, {
          model: model || undefined,
          promptLength: validatedPrompt.length,
          userAgent,
          path,
        });
        
        // Log failed API key usage
        logApiKeyUsage(clientIP, providerId, false, userAgent);

        return {
          providerId: providerId as ProviderId,
          content: '',
          error: sanitizeError(error),
          model: model || undefined,
        };
      }
    });

    // Wait for all requests to complete (or fail)
    const results = await Promise.allSettled(promises);

    const responses: ChatResponse[] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const providerId = validatedProviderIds[index] as ProviderId;
        const model = selectedModels?.[providerId];
        return {
          providerId,
          content: '',
          error: sanitizeError(result.reason),
          model: model || undefined,
        };
      }
    });

    // Process moderator if enabled
    if (moderator?.enabled && moderator.providerId && moderator.model) {
      const moderatorProviderInstance = providerRegistry.get(moderator.providerId);
      const moderatorRequiresKey = moderatorProviderInstance?.requiresApiKey ?? true;
      
      // Validate moderator provider has API key
      let moderatorApiKey: string | undefined;
      const moderatorServerKey = config.apiKeys[moderator.providerId];
      if (moderatorServerKey) {
        moderatorApiKey = moderatorServerKey;
      } else if (apiKeys?.[moderator.providerId] && apiKeys[moderator.providerId].trim().length > 0) {
        moderatorApiKey = apiKeys[moderator.providerId];
      } else if (!moderatorRequiresKey) {
        // Moderator provider doesn't require API key (e.g., local Ollama)
        moderatorApiKey = '';
      }

      if (moderatorApiKey === undefined && moderatorRequiresKey) {
        // Add error response for moderator (except providers that don't require keys)
        responses.push({
          providerId: 'moderator',
          content: '',
          error: 'Missing API key for moderator provider',
        });
      } else if (validatedProviderIds.length === 0) {
        // No providers selected
        responses.push({
          providerId: 'moderator',
          content: '',
          error: 'No providers selected for comparison',
        });
      } else {
        try {
          // Get moderator provider
          const moderatorProvider = providerRegistry.get(moderator.providerId);
          if (!moderatorProvider) {
            responses.push({
              providerId: 'moderator',
              content: '',
              error: 'Moderator provider not found',
            });
          } else {
            // Create moderator prompt
            const moderatorPrompt = createModeratorPrompt(validatedPrompt, responses);
            
            // Call moderator provider
            const options = { model: moderator.model };
            const rawModeratorContent = await moderatorProvider.generateResponse(moderatorPrompt, moderatorApiKey, options);
            
            // Sanitize moderator response
            const sanitizedModeratorContent = sanitizeLlmResponse(rawModeratorContent);
            
            // Log successful moderator API key usage
            logApiKeyUsage(clientIP, moderator.providerId, true, userAgent);
            
            // Add moderator response
            responses.push({
              providerId: 'moderator',
              content: sanitizedModeratorContent,
              model: moderator.model,
            });
          }
        } catch (error) {
          // Log moderator error
          console.error(`[Moderator] Error generating response:`, {
            providerId: moderator.providerId,
            model: moderator.model,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          
          // Log provider error with audit logger
          logProviderError(clientIP, moderator.providerId, error, {
            model: moderator.model,
            promptLength: validatedPrompt.length,
            userAgent,
            path,
          });
          
          // Log failed API key usage
          logApiKeyUsage(clientIP, moderator.providerId, false, userAgent);
          
          // Add error response for moderator
          responses.push({
            providerId: 'moderator',
            content: '',
            error: sanitizeError(error),
            model: moderator.model,
          });
        }
      }
    }

    return NextResponse.json(
      { responses },
      {
        headers: {
          'X-RateLimit-Limit': config.rateLimit.maxRequests.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
        }
      }
    );
  } catch (error) {
    // Log error server-side (without sensitive data)
    console.error('API route error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

