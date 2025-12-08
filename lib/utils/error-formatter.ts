/**
 * Error formatting and categorization utilities
 */

export type ErrorType =
  | 'network'
  | 'validation'
  | 'authentication'
  | 'rate-limit'
  | 'quota'
  | 'timeout'
  | 'api'
  | 'content-safety'
  | 'unknown';

export interface FormattedError {
  type: ErrorType;
  message: string;
  userMessage: string;
  suggestion?: string;
  canRetry: boolean;
  technicalDetails?: string;
}

/**
 * Categorize error based on error message patterns
 */
export function categorizeError(errorMessage: string): ErrorType {
  const lowerMessage = errorMessage.toLowerCase();

  // Network errors
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('fetch') ||
    lowerMessage.includes('connection') ||
    lowerMessage.includes('failed to fetch') ||
    lowerMessage.includes('networkerror')
  ) {
    return 'network';
  }

  // Authentication errors
  if (
    lowerMessage.includes('401') ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('invalid api key') ||
    lowerMessage.includes('authentication') ||
    lowerMessage.includes('api key') ||
    lowerMessage.includes('missing api key') ||
    lowerMessage.includes('csrf token')
  ) {
    return 'authentication';
  }

  // Rate limit errors
  if (
    lowerMessage.includes('429') ||
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('too many requests')
  ) {
    return 'rate-limit';
  }

  // Quota/billing errors
  if (
    lowerMessage.includes('quota') ||
    lowerMessage.includes('billing') ||
    lowerMessage.includes('insufficient credits') ||
    lowerMessage.includes('payment')
  ) {
    return 'quota';
  }

  // Timeout errors
  if (
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('timed out') ||
    lowerMessage.includes('request timeout')
  ) {
    return 'timeout';
  }

  // Validation errors
  if (
    lowerMessage.includes('validation') ||
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('must be') ||
    lowerMessage.includes('cannot be empty') ||
    lowerMessage.includes('exceeds maximum') ||
    lowerMessage.includes('origin validation') ||
    lowerMessage.includes('allowed origins')
  ) {
    return 'validation';
  }

  // Content safety/blocking errors
  if (
    lowerMessage.includes('prohibited_content') ||
    lowerMessage.includes('content safety') ||
    lowerMessage.includes('blocked due to') ||
    lowerMessage.includes('safety filters') ||
    lowerMessage.includes('text not available') ||
    lowerMessage.includes('recitation')
  ) {
    return 'content-safety';
  }

  // Empty response errors
  if (
    lowerMessage.includes('no response') ||
    lowerMessage.includes('empty response') ||
    lowerMessage.includes('response was truncated')
  ) {
    return 'api';
  }

  // API errors (general API issues)
  if (
    lowerMessage.includes('api') ||
    lowerMessage.includes('server error') ||
    lowerMessage.includes('500') ||
    lowerMessage.includes('502') ||
    lowerMessage.includes('503')
  ) {
    return 'api';
  }

  return 'unknown';
}

/**
 * Format error message to be user-friendly
 * Supports error messages with technical details in format: "Error message ||| Technical details"
 */
export function formatErrorMessage(errorMessage: string, technicalDetailsOverride?: string): FormattedError {
  // Extract technical details if embedded in error message
  let message = errorMessage;
  let extractedTechnicalDetails: string | undefined;
  
  if (errorMessage.includes(' ||| ')) {
    const parts = errorMessage.split(' ||| ');
    message = parts[0];
    extractedTechnicalDetails = parts.slice(1).join(' ||| ');
  }
  
  const type = categorizeError(message);
  const technicalDetails = technicalDetailsOverride || extractedTechnicalDetails || (message !== errorMessage ? errorMessage : undefined);
  const lowerMessage = message.toLowerCase();

  let userMessage = errorMessage;
  let suggestion: string | undefined;
  let canRetry = false;

  switch (type) {
    case 'network':
      userMessage = 'Network connection failed. Please check your internet connection.';
      suggestion = 'Check your internet connection and try again.';
      canRetry = true;
      break;

    case 'authentication':
      // Check if it's a CSRF token error
      if (lowerMessage.includes('csrf token')) {
        userMessage = 'Security token validation failed. Your session may have expired.';
        suggestion = 'Please refresh the page to get a new security token, then try again.';
        canRetry = true;
      } else {
        userMessage = 'Authentication failed. Please check your API key.';
        suggestion = 'Go to Settings and verify your API key is correct.';
        canRetry = false;
      }
      break;

    case 'rate-limit':
      userMessage = 'Rate limit exceeded. Please wait a moment before trying again.';
      suggestion = 'Wait a few seconds and try again, or reduce the number of requests.';
      canRetry = true;
      break;

    case 'quota':
      userMessage = 'Quota exceeded or billing issue. Please check your account.';
      suggestion = 'Check your provider account for billing or quota limits.';
      canRetry = false;
      break;

    case 'timeout':
      userMessage = 'Request timed out. The server took too long to respond.';
      suggestion = 'Try again in a moment. The service may be experiencing high load.';
      canRetry = true;
      break;

    case 'validation':
      // Check if it's an origin validation error
      if (lowerMessage.includes('origin validation') || lowerMessage.includes('allowed origins')) {
        userMessage = 'Origin validation failed. This usually happens when accessing the app from a different URL than configured.';
        suggestion = 'Try refreshing the page, or if you\'re a developer, check your ALLOWED_ORIGINS environment variable configuration.';
        canRetry = true;
      } else {
        // Keep other validation messages as-is, they're usually user-friendly
        userMessage = errorMessage;
        canRetry = false;
      }
      break;

    case 'api':
      // Check for specific API error types
      if (lowerMessage.includes('no response') || lowerMessage.includes('empty response')) {
        userMessage = 'The provider returned an empty response. This may be due to content filters, token limits, or service issues.';
        suggestion = 'Try rephrasing your prompt, checking your API key settings, or trying again in a moment.';
        canRetry = true;
      } else if (lowerMessage.includes('truncated') || lowerMessage.includes('token limit')) {
        userMessage = 'Response was truncated due to token limit.';
        suggestion = 'Try reducing the prompt length or increasing the max tokens setting.';
        canRetry = true;
      } else {
        userMessage = 'API error occurred. The service may be temporarily unavailable.';
        suggestion = 'Try again in a few moments. If the problem persists, check the service status.';
        canRetry = true;
      }
      break;

    case 'content-safety':
      userMessage = 'Response was blocked due to content safety filters.';
      suggestion = 'The provider\'s safety settings prevented a response. Try rephrasing your prompt or adjusting the content to be more neutral.';
      canRetry = true;
      break;

    case 'unknown':
    default:
      userMessage = errorMessage || 'An unexpected error occurred.';
      suggestion = 'Try again, or check your settings if the problem persists.';
      canRetry = true;
      break;
  }

  return {
    type,
    message: message,
    userMessage,
    suggestion,
    canRetry,
    technicalDetails: technicalDetails && technicalDetails !== userMessage ? technicalDetails : undefined,
  };
}

/**
 * Extract provider name from error message if present
 */
export function extractProviderFromError(errorMessage: string): string | null {
  const providers = ['openai', 'anthropic', 'google', 'cohere', 'grok'];
  const lowerMessage = errorMessage.toLowerCase();
  
  for (const provider of providers) {
    if (lowerMessage.includes(provider)) {
      return provider;
    }
  }
  
  return null;
}

