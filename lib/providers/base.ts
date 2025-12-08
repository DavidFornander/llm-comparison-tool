import type { ProviderId } from '@/types';

export interface ProviderResponse {
  content: string;
  error?: string;
}

export interface RequestDetails {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  prompt?: string;
}

export interface ResponseDetails {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: unknown;
  data?: unknown;
}

export interface RequestResponseLog {
  request: RequestDetails;
  response?: ResponseDetails;
}

export abstract class LLMProvider {
  abstract readonly id: ProviderId;
  abstract readonly name: string;
  abstract readonly displayName: string;
  readonly requiresApiKey: boolean = true; // Default to true for backward compatibility

  /**
   * Generate a response from the LLM provider
   * @param prompt - The user's prompt
   * @param apiKey - The API key for the provider
   * @param options - Optional configuration (model, temperature, etc.)
   * @returns The generated response
   */
  abstract generateResponse(
    prompt: string,
    apiKey: string,
    options?: Record<string, unknown>
  ): Promise<string>;

  /**
   * Validate API key format (basic validation)
   */
  validateApiKey(apiKey: string): boolean {
    return Boolean(apiKey && apiKey.trim().length > 0);
  }

  /**
   * Handle errors consistently across providers
   */
  protected handleError(error: unknown): string {
    if (error instanceof Error) {
      // Check for common API errors
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        return 'Invalid API key. Please check your API key in settings.';
      }
      if (error.message.includes('429') || error.message.includes('rate limit')) {
        return 'Rate limit exceeded. Please try again later.';
      }
      if (error.message.includes('quota') || error.message.includes('billing')) {
        return 'Quota exceeded or billing issue. Please check your account.';
      }
      return error.message;
    }
    return 'An unknown error occurred';
  }

  /**
   * Create a timeout promise for requests
   */
  protected createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), ms);
    });
  }

  /**
   * Execute request with timeout
   */
  protected async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number = 600000 // 10 minutes default
  ): Promise<T> {
    return Promise.race([promise, this.createTimeout(timeoutMs)]);
  }

  /**
   * Fetch available models from the provider API
   * Override this method in providers that support dynamic model fetching
   * @param apiKey - The API key for the provider
   * @returns Array of available model names
   */
  async fetchAvailableModels(apiKey: string): Promise<string[]> {
    // Default implementation returns empty array
    // Providers that support dynamic model fetching should override this method
    return [];
  }

  /**
   * Sanitize API key from request details for logging
   */
  protected sanitizeApiKey(value: string): string {
    if (!value || value.length < 8) return '[REDACTED]';
    return value.substring(0, 4) + '...' + value.substring(value.length - 4);
  }

  /**
   * Format request/response details for error logging
   */
  protected formatRequestResponseLog(log: RequestResponseLog): string {
    const parts: string[] = [];
    
    parts.push('=== REQUEST ===');
    if (log.request.url) {
      parts.push(`URL: ${log.request.url.replace(/key=[^&]+/, 'key=[REDACTED]')}`);
    }
    if (log.request.method) {
      parts.push(`Method: ${log.request.method}`);
    }
    if (log.request.model) {
      parts.push(`Model: ${log.request.model}`);
    }
    if (log.request.temperature !== undefined) {
      parts.push(`Temperature: ${log.request.temperature}`);
    }
    if (log.request.maxTokens !== undefined) {
      parts.push(`Max Tokens: ${log.request.maxTokens}`);
    }
    if (log.request.prompt) {
      const promptPreview = log.request.prompt.length > 200 
        ? log.request.prompt.substring(0, 200) + '...' 
        : log.request.prompt;
      parts.push(`Prompt: ${promptPreview}`);
    }
    if (log.request.body) {
      const bodyStr = JSON.stringify(log.request.body, null, 2);
      // Sanitize API keys in body
      const sanitizedBody = bodyStr.replace(/"api[_-]?key":\s*"[^"]+"/gi, '"api_key": "[REDACTED]"')
                                    .replace(/"key":\s*"[^"]+"/gi, '"key": "[REDACTED]"')
                                    .replace(/key=[^&"']+/gi, 'key=[REDACTED]');
      parts.push(`Body: ${sanitizedBody}`);
    }
    if (log.request.headers) {
      const sanitizedHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(log.request.headers)) {
        if (key.toLowerCase().includes('key') || key.toLowerCase().includes('authorization')) {
          sanitizedHeaders[key] = '[REDACTED]';
        } else {
          sanitizedHeaders[key] = value;
        }
      }
      parts.push(`Headers: ${JSON.stringify(sanitizedHeaders, null, 2)}`);
    }

    if (log.response) {
      parts.push('\n=== RESPONSE ===');
      if (log.response.status) {
        parts.push(`Status: ${log.response.status} ${log.response.statusText || ''}`);
      }
      if (log.response.headers) {
        parts.push(`Headers: ${JSON.stringify(log.response.headers, null, 2)}`);
      }
      if (log.response.body || log.response.data) {
        const responseData = log.response.body || log.response.data;
        const responseStr = typeof responseData === 'string' 
          ? responseData 
          : JSON.stringify(responseData, null, 2);
        // Limit response size for display
        const truncatedResponse = responseStr.length > 2000 
          ? responseStr.substring(0, 2000) + '\n... (truncated)' 
          : responseStr;
        parts.push(`Body: ${truncatedResponse}`);
      }
    }

    return parts.join('\n');
  }
}

