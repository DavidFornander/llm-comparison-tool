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
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval and unsafe-inline
    "style-src 'self' 'unsafe-inline'", // Tailwind requires unsafe-inline
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
  response.headers.set('Content-Security-Policy', csp);

  // CORS headers (only for API routes)
  if (request.nextUrl.pathname.startsWith('/api')) {
    const origin = request.headers.get('origin');
    
    if (appConfig.security.enableCors) {
      if (origin && appConfig.security.allowedOrigins.includes(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
        response.headers.set('Access-Control-Max-Age', '86400');
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

