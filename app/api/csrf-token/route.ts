import { NextRequest, NextResponse } from 'next/server';
import { generateCsrfToken, createSignedToken, CSRF_COOKIE_NAME } from '@/lib/security/csrf';
import { getClientIP } from '@/lib/security/ip-filter';
import { logApiKeyUsage } from '@/lib/security/audit-logger';

/**
 * GET /api/csrf-token - Get CSRF token for client
 */
export async function GET(request: NextRequest) {
  try {
    const token = generateCsrfToken();
    const signedToken = createSignedToken(token);

    const response = NextResponse.json({ token: signedToken });

    // Set CSRF token in httpOnly cookie
    response.cookies.set(CSRF_COOKIE_NAME, signedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    // Log token generation
    const clientIP = getClientIP(request);
    logApiKeyUsage(clientIP, 'csrf_token_generated', true);

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}

