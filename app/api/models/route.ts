import { NextRequest, NextResponse } from 'next/server';
import { providerRegistry } from '@/lib/provider-registry';
import { validateOrigin } from '@/lib/security/csrf';
import { getClientIP } from '@/lib/security/ip-filter';
import { logSuspiciousActivity } from '@/lib/security/audit-logger';
import config from '@/lib/config';
import type { ProviderId } from '@/types';

/**
 * GET /api/models - Fetch available models for a provider
 * Query parameters:
 * - providerId: The provider ID (e.g., 'google')
 * - apiKey: The API key for the provider (optional if server-side key exists)
 */
export async function GET(request: NextRequest) {
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || undefined;
  const path = request.nextUrl.pathname;

  try {
    // Origin validation
    if (!validateOrigin(request, config.security.allowedOrigins)) {
      const origin = request.headers.get('origin') || request.headers.get('referer') || 'unknown';
      logSuspiciousActivity(clientIP, 'Invalid origin', path, userAgent);
      return NextResponse.json(
        { error: 'Origin validation failed' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const providerId = searchParams.get('providerId') as ProviderId | null;
    const clientApiKey = searchParams.get('apiKey');

    if (!providerId) {
      return NextResponse.json(
        { error: 'providerId query parameter is required' },
        { status: 400 }
      );
    }

    // Validate provider ID
    const provider = providerRegistry.get(providerId);
    if (!provider) {
      return NextResponse.json(
        { error: `Invalid provider ID: ${providerId}` },
        { status: 400 }
      );
    }

    // Get API key (prefer server-side, fallback to client-provided)
    const providerInstance = providerRegistry.get(providerId);
    const requiresKey = providerInstance?.requiresApiKey ?? true;
    
    let apiKey: string | undefined;
    
    // Check server-side key first
    const serverKey = config.apiKeys[providerId];
    if (serverKey) {
      apiKey = serverKey;
    } else if (clientApiKey && clientApiKey.trim().length > 0) {
      // Fallback to client-provided key
      apiKey = clientApiKey;
    } else if (!requiresKey) {
      // Provider doesn't require API key (e.g., local Ollama)
      apiKey = ''; // Use empty string
    } else {
      return NextResponse.json(
        { error: 'API key is required. Please provide an API key or configure server-side keys.' },
        { status: 400 }
      );
    }

    // Only validate API key if provider requires one
    if (requiresKey && (!apiKey || !provider.validateApiKey(apiKey))) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 400 }
      );
    }

    // Fetch available models from the provider
    // Use empty string if provider doesn't require key and apiKey is undefined
    try {
      const models = await provider.fetchAvailableModels(apiKey || '');
      return NextResponse.json({ models });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch models';
      console.error(`Error fetching models for ${providerId}:`, errorMessage);
      
      // Don't expose internal error details to client
      return NextResponse.json(
        { error: 'Failed to fetch available models. Please check your API key and try again.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('API route error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

