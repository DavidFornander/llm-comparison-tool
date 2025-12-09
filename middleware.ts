import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import appConfig from './lib/config';
import { ipFilter, getClientIP } from './lib/security/ip-filter';
import { logSuspiciousActivity } from './lib/security/audit-logger';

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
 * Check if an IP address is in a valid local network range (RFC 1918)
 */
function isValidLocalNetworkIP(hostname: string): boolean {
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

export function middleware(request: NextRequest) {
  // HTTPS enforcement in production
  if (appConfig.nodeEnv === 'production') {
    const protocol = request.headers.get('x-forwarded-proto') || 
                     (request.url.startsWith('https://') ? 'https' : 'http');
    
    if (protocol !== 'https') {
      const httpsUrl = request.url.replace(/^http:/, 'https:');
      return NextResponse.redirect(httpsUrl, 301);
    }
  }

  // IP filtering
  const clientIP = getClientIP(request);
  const ipCheck = ipFilter.isAllowed(clientIP);
  
  if (!ipCheck.allowed) {
    logSuspiciousActivity(clientIP, `IP blocked: ${ipCheck.reason}`, request.nextUrl.pathname);
    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    );
  }

  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  // Note: CSP doesn't support wildcards in IP addresses, so we only allow localhost
  // Server-side origin validation in middleware handles local network IPs
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval and unsafe-inline
    "style-src 'self' 'unsafe-inline'", // Tailwind requires unsafe-inline
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:*",
    "frame-ancestors 'none'",
  ].join('; ');
  response.headers.set('Content-Security-Policy', csp);

  // CORS headers (only for API routes)
  if (request.nextUrl.pathname.startsWith('/api')) {
    const origin = request.headers.get('origin');
    
    if (appConfig.security.enableCors) {
      // Check if origin is allowed (exact match or local network)
      let isAllowed = false;
      if (origin) {
        // Check exact match first
        if (appConfig.security.allowedOrigins.includes(origin)) {
          isAllowed = true;
        } else {
          // Check if it's a local network IP
          try {
            const originUrl = new URL(origin);
            const hostname = originUrl.hostname;
            // Allow localhost and private IP ranges (with proper validation)
            if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
              isAllowed = true;
            } else if (isValidLocalNetworkIP(hostname)) {
              isAllowed = true;
            }
          } catch {
            // Invalid URL, don't allow
          }
        }
      }
      
      if (isAllowed && origin) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
        response.headers.set('Access-Control-Max-Age', '86400');
        response.headers.set('Access-Control-Allow-Credentials', 'true');
      }
    }

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: response.headers,
      });
    }
  }

  // Enhanced security headers
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('X-Download-Options', 'noopen');
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');

  // HSTS (only in production over HTTPS)
  if (appConfig.nodeEnv === 'production' && request.url.startsWith('https://')) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Set SameSite cookie attribute for CSRF protection
  // This will be handled by Next.js cookie API in API routes

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

