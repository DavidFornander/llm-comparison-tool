/**
 * Input validation and sanitization utilities
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Maximum prompt length (configurable via env)
 */
const MAX_PROMPT_LENGTH = parseInt(
  process.env.RATE_LIMIT_MAX_PROMPT_LENGTH || '10000',
  10
);

/**
 * Maximum request body size in bytes
 */
const MAX_REQUEST_SIZE_BYTES = parseInt(
  process.env.MAX_REQUEST_SIZE_MB || '10',
  10
) * 1024 * 1024;

/**
 * Validate and sanitize user prompt
 */
export function validatePrompt(prompt: unknown): string {
  if (typeof prompt !== 'string') {
    throw new ValidationError('Prompt must be a string');
  }

  if (prompt.trim().length === 0) {
    throw new ValidationError('Prompt cannot be empty');
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new ValidationError(
      `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters`
    );
  }

  // Sanitize: remove null bytes and control characters (except newlines and tabs)
  const sanitized = prompt
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, ''); // Remove control chars except \n, \t

  return sanitized.trim();
}

/**
 * Validate provider IDs array
 */
export function validateProviderIds(providerIds: unknown): string[] {
  if (!Array.isArray(providerIds)) {
    throw new ValidationError('Provider IDs must be an array');
  }

  if (providerIds.length === 0) {
    throw new ValidationError('At least one provider must be selected');
  }

  const validProviderIds = ['openai', 'anthropic', 'google', 'cohere', 'grok', 'ollama'];
  const invalidIds = providerIds.filter(
    (id) => typeof id !== 'string' || !validProviderIds.includes(id)
  );

  if (invalidIds.length > 0) {
    throw new ValidationError(`Invalid provider IDs: ${invalidIds.join(', ')}`);
  }

  // Remove duplicates
  return [...new Set(providerIds as string[])];
}

/**
 * Validate request body size
 */
export function validateRequestSize(contentLength: number | null): void {
  if (contentLength === null) {
    return; // Can't validate without content length
  }

  if (contentLength > MAX_REQUEST_SIZE_BYTES) {
    throw new ValidationError(
      `Request body exceeds maximum size of ${MAX_REQUEST_SIZE_BYTES / 1024 / 1024}MB`
    );
  }
}

/**
 * Sanitize error message to prevent information leakage
 * Preserves technical details if available
 */
export function sanitizeError(error: unknown): string {
  if (error instanceof ValidationError) {
    return error.message;
  }

  if (error instanceof Error) {
    const message = error.message;
    const technicalDetails = (error as Error & { technicalDetails?: string })?.technicalDetails;
    
    // Append technical details to the error message in a parseable format
    // Format: "Error message ||| Technical details"
    if (technicalDetails && technicalDetails !== message) {
      return `${message} ||| ${technicalDetails}`;
    }
    
    return message;
  }

  return 'An unknown error occurred.';
}

/**
 * Validate API key format (basic check)
 */
export function validateApiKeyFormat(apiKey: string, providerId: string): boolean {
  if (!apiKey || apiKey.trim().length === 0) {
    return false;
  }

  // Basic format validation per provider
  switch (providerId) {
    case 'openai':
      return apiKey.startsWith('sk-') && apiKey.length > 20;
    case 'anthropic':
      return apiKey.startsWith('sk-ant-') && apiKey.length > 20;
    case 'google':
      return apiKey.length > 20; // Google keys vary in format
    case 'cohere':
      return apiKey.length > 20; // Cohere keys vary in format
    case 'grok':
      return apiKey.length > 20; // Grok/xAI keys vary in format
    default:
      return apiKey.length > 10; // Generic minimum length
  }
}

