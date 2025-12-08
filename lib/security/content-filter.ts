/**
 * Enhanced Content Filtering and Output Sanitization
 */

/**
 * Sanitize HTML to prevent XSS attacks
 */
export function sanitizeHtml(html: string): string {
  // Remove script tags and event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:text\/html/gi, '') // Remove data URIs that could contain HTML
    .replace(/<iframe/gi, '&lt;iframe') // Escape iframes
    .replace(/<object/gi, '&lt;object') // Escape objects
    .replace(/<embed/gi, '&lt;embed'); // Escape embeds
}

/**
 * Sanitize text content (remove potentially dangerous characters)
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handler patterns
    .trim();
}

/**
 * Detect potentially malicious patterns in text
 */
export function detectMaliciousPatterns(text: string): {
  isMalicious: boolean;
  patterns: string[];
} {
  const patterns: string[] = [];
  const lowerText = text.toLowerCase();

  // SQL injection patterns
  const sqlPatterns = [
    /(\bunion\b.*\bselect\b)/i,
    /(\bselect\b.*\bfrom\b)/i,
    /(\bdrop\b.*\btable\b)/i,
    /(\bdelete\b.*\bfrom\b)/i,
    /(\binsert\b.*\binto\b)/i,
    /('.*or.*'.*=.*')/i,
    /(--|\#|\/\*|\*\/)/,
  ];

  // XSS patterns
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /data:text\/html/i,
    /vbscript:/i,
  ];

  // Command injection patterns
  const commandPatterns = [
    /[;&|`$(){}[\]]/,
    /\b(cat|ls|pwd|whoami|id|uname|wget|curl)\b/i,
    /\/etc\/passwd/i,
    /\/proc\/self/i,
  ];

  // Check for SQL injection
  for (const pattern of sqlPatterns) {
    if (pattern.test(text)) {
      patterns.push('sql_injection');
      break;
    }
  }

  // Check for XSS
  for (const pattern of xssPatterns) {
    if (pattern.test(text)) {
      patterns.push('xss');
      break;
    }
  }

  // Check for command injection
  for (const pattern of commandPatterns) {
    if (pattern.test(text)) {
      patterns.push('command_injection');
      break;
    }
  }

  // Check for excessive length (potential DoS)
  if (text.length > 100000) {
    patterns.push('potential_dos');
  }

  return {
    isMalicious: patterns.length > 0,
    patterns,
  };
}

/**
 * Sanitize LLM response output
 */
export function sanitizeLlmResponse(response: string): string {
  // First check for malicious patterns
  const detection = detectMaliciousPatterns(response);

  if (detection.isMalicious) {
    // Log the detection but still sanitize
    console.warn('Potentially malicious content detected:', detection.patterns);
  }

  // Remove HTML tags but preserve text content
  let sanitized = response
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '');

  // Escape remaining HTML
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return sanitized;
}

/**
 * Detect and redact PII (Personally Identifiable Information)
 */
export function detectAndRedactPII(text: string): {
  sanitized: string;
  detectedTypes: string[];
} {
  const detectedTypes: string[] = [];
  let sanitized = text;

  // Email addresses
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  if (emailRegex.test(text)) {
    detectedTypes.push('email');
    sanitized = sanitized.replace(emailRegex, '[EMAIL_REDACTED]');
  }

  // Phone numbers (US format)
  const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
  if (phoneRegex.test(text)) {
    detectedTypes.push('phone');
    sanitized = sanitized.replace(phoneRegex, '[PHONE_REDACTED]');
  }

  // Credit card numbers (basic pattern)
  const creditCardRegex = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g;
  if (creditCardRegex.test(text)) {
    detectedTypes.push('credit_card');
    sanitized = sanitized.replace(creditCardRegex, '[CARD_REDACTED]');
  }

  // SSN (US format)
  const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
  if (ssnRegex.test(text)) {
    detectedTypes.push('ssn');
    sanitized = sanitized.replace(ssnRegex, '[SSN_REDACTED]');
  }

  return { sanitized, detectedTypes };
}

/**
 * Filter toxic or harmful content (basic keyword-based)
 */
export function filterToxicContent(text: string): {
  isToxic: boolean;
  filtered: string;
} {
  // This is a basic implementation - in production, use a proper content moderation API
  const toxicKeywords: string[] = [
    // Add your list of toxic keywords here
    // This is just an example
  ];

  const lowerText = text.toLowerCase();
  const isToxic = toxicKeywords.some(keyword => lowerText.includes(keyword));

  // For now, just return the original text
  // In production, you might want to replace or remove toxic content
  return {
    isToxic,
    filtered: text,
  };
}

