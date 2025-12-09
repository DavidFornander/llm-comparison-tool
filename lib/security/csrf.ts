/**
 * CSRF Protection Implementation
 */

import { randomBytes, createHmac } from 'crypto';

const CSRF_SECRET = process.env.CSRF_SECRET || 'change-me-in-production';
const CSRF_TOKEN_LENGTH = 32;
const CSRF_TOKEN_HEADER = 'X-CSRF-Token';
const CSRF_COOKIE_NAME = 'csrf-token';

/**
 * Generate a CSRF token
 */
export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Create a signed CSRF token
 */
export function createSignedToken(token: string): string {
  const hmac = createHmac('sha256', CSRF_SECRET);
  hmac.update(token);
  return `${token}.${hmac.digest('hex')}`;
}

/**
 * Verify a signed CSRF token
 */
export function verifySignedToken(signedToken: string): string | null {
  const parts = signedToken.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [token, signature] = parts;
  const expectedSignature = createHmac('sha256', CSRF_SECRET)
    .update(token)
    .digest('hex');

  if (signature !== expectedSignature) {
    return null;
  }

  return token;
}

/**
 * Get CSRF token from request
 */
export function getCsrfTokenFromRequest(request: Request): string | null {
  // Try header first
  const headerToken = request.headers.get(CSRF_TOKEN_HEADER);
  if (headerToken) {
    return headerToken;
  }

  // Try cookie
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    return cookies[CSRF_COOKIE_NAME] || null;
  }

  return null;
}

/**
 * Validate CSRF token
 */
export function validateCsrfToken(request: Request): boolean {
  // Skip CSRF validation for GET, HEAD, OPTIONS requests
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return true;
  }

  const token = getCsrfTokenFromRequest(request);
  if (!token) {
    return false;
  }

  // Verify the signed token
  const verifiedToken = verifySignedToken(token);
  return verifiedToken !== null;
}

/**
 * Validate that an IP octet is between 0-255
 */
function isValidOctet(octet: string): boolean {
  const num = parseInt(octet, 10);
  return !isNaN(num) && num >= 0 && num <= 255;
}

/**
 * Validate that an IP address has valid octets (0-255)
 */
function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return false;
  }
  return parts.every(part => isValidOctet(part));
}

/**
 * Check if an IP/hostname is in a local network range
 */
function isLocalNetwork(hostname: string): boolean {
  // Check for localhost variants
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return true;
  }

  // Validate it's a valid IPv4 first
  if (!isValidIPv4(hostname)) {
    return false;
  }

  const parts = hostname.split('.').map(Number);

  // Check for private IP ranges (RFC 1918)
  // 192.168.0.0/16
  if (parts[0] === 192 && parts[1] === 168) {
    return true;
  }
  
  // 10.0.0.0/8
  if (parts[0] === 10) {
    return true;
  }
  
  // 172.16.0.0/12
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true;
  }

  return false;
}

/**
 * Validate origin header for additional CSRF protection
 */
export function validateOrigin(request: Request, allowedOrigins: string[]): boolean {
  const origin = request.headers.get('origin');
  if (!origin) {
    // Some requests (like same-origin) don't send origin
    const referer = request.headers.get('referer');
    if (!referer) {
      return false;
    }
    try {
      const refererUrl = new URL(referer);
      
      // Allow local network IPs
      if (isLocalNetwork(refererUrl.hostname)) {
        return true;
      }
      
      return allowedOrigins.some(allowed => {
        try {
          const allowedUrl = new URL(allowed);
          return refererUrl.origin === allowedUrl.origin;
        } catch {
          return false;
        }
      });
    } catch {
      return false;
    }
  }

  try {
    const originUrl = new URL(origin);
    
    // Allow local network IPs
    if (isLocalNetwork(originUrl.hostname)) {
      return true;
    }
  } catch {
    // Invalid URL, fall through to exact match check
  }

  return allowedOrigins.includes(origin);
}

export { CSRF_COOKIE_NAME, CSRF_TOKEN_HEADER };

