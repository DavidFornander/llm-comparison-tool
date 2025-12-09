import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import appConfig from './lib/config';
import { ipFilter, getClientIP } from './lib/security/ip-filter';
import { logSuspiciousActivity } from './lib/security/audit-logger';

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
  // Allow connections from local network IPs
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval and unsafe-inline
    "style-src 'self' 'unsafe-inline'", // Tailwind requires unsafe-inline
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' http://localhost:* http://127.0.0.1:* http://192.168.*:* http://10.*:* http://172.16.*:* http://172.17.*:* http://172.18.*:* http://172.19.*:* http://172.20.*:* http://172.21.*:* http://172.22.*:* http://172.23.*:* http://172.24.*:* http://172.25.*:* http://172.26.*:* http://172.27.*:* http://172.28.*:* http://172.29.*:* http://172.30.*:* http://172.31.*:*",
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
            // Allow localhost and private IP ranges
            if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' ||
                /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
                /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
                /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
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

