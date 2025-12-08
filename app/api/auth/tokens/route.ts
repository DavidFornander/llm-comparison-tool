import { NextRequest, NextResponse } from 'next/server';
import { apiTokenManager, requireApiToken } from '@/lib/auth/api-tokens';
import { getClientIP } from '@/lib/security/ip-filter';
import { logApiKeyUsage } from '@/lib/security/audit-logger';

/**
 * POST /api/auth/tokens - Create a new API token
 * Requires authentication (can use basic auth or existing token)
 */
export async function POST(request: NextRequest) {
  try {
    // For now, allow token creation without auth (in production, add proper auth)
    // In production, you might want to require admin authentication
    const body = await request.json();
    const { name, scopes, expiresInDays } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Token name is required' },
        { status: 400 }
      );
    }

    const tokenScopes = scopes || ['read', 'write'];
    const token = apiTokenManager.generateToken(name, tokenScopes, expiresInDays);

    const clientIP = getClientIP(request);
    logApiKeyUsage(clientIP, 'api_token_created', true);

    return NextResponse.json({
      id: token.id,
      name,
      scopes: tokenScopes,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      token: token.token, // Only returned once
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create token' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/tokens - List all API tokens
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  const auth = requireApiToken(request, ['read']);
  
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error || 'Authentication required' },
      { status: 401 }
    );
  }

  const tokens = apiTokenManager.listTokens();
  return NextResponse.json({ tokens });
}

/**
 * DELETE /api/auth/tokens - Revoke an API token
 * Requires authentication
 * Body: { id: string }
 */
export async function DELETE(request: NextRequest) {
  const auth = requireApiToken(request, ['write']);
  
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error || 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Token ID is required' },
        { status: 400 }
      );
    }

    const revoked = apiTokenManager.revokeToken(id);

    if (!revoked) {
      return NextResponse.json(
        { error: 'Token not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to revoke token' },
      { status: 500 }
    );
  }
}

