/**
 * API Token Authentication
 */

import { randomBytes, createHmac, timingSafeEqual } from 'crypto';

interface APIToken {
  id: string;
  token: string;
  hashedToken: string;
  name: string;
  scopes: string[];
  createdAt: Date;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
}

class APITokenManager {
  private tokens: Map<string, APIToken> = new Map();
  private secret: string;

  constructor() {
    this.secret = process.env.API_TOKEN_SECRET || 'change-me-in-production';
  }

  /**
   * Generate a new API token
   */
  generateToken(name: string, scopes: string[] = ['read', 'write'], expiresInDays?: number): {
    id: string;
    token: string;
    createdAt: Date;
    expiresAt: Date | null;
  } {
    const id = randomBytes(16).toString('hex');
    const token = `llm_${randomBytes(32).toString('hex')}`;
    const hashedToken = this.hashToken(token);
    
    const expiresAt = expiresInDays 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const apiToken: APIToken = {
      id,
      token,
      hashedToken,
      name,
      scopes,
      createdAt: new Date(),
      expiresAt,
      lastUsedAt: null,
    };

    this.tokens.set(id, apiToken);

    return {
      id,
      token, // Return plain token only once
      createdAt: apiToken.createdAt,
      expiresAt: apiToken.expiresAt,
    };
  }

  /**
   * Hash a token
   */
  private hashToken(token: string): string {
    return createHmac('sha256', this.secret)
      .update(token)
      .digest('hex');
  }

  /**
   * Verify an API token
   */
  verifyToken(token: string): {
    valid: boolean;
    tokenId?: string;
    scopes?: string[];
    expired?: boolean;
  } {
    // Extract token ID from token format: llm_<token>
    if (!token.startsWith('llm_')) {
      return { valid: false };
    }

    const hashedToken = this.hashToken(token);

    // Find matching token
    for (const [id, apiToken] of this.tokens.entries()) {
      // Use timing-safe comparison
      if (timingSafeEqual(Buffer.from(hashedToken), Buffer.from(apiToken.hashedToken))) {
        // Check expiration
        if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
          return { valid: false, expired: true };
        }

        // Update last used
        apiToken.lastUsedAt = new Date();

        return {
          valid: true,
          tokenId: id,
          scopes: apiToken.scopes,
        };
      }
    }

    return { valid: false };
  }

  /**
   * Revoke a token
   */
  revokeToken(tokenId: string): boolean {
    return this.tokens.delete(tokenId);
  }

  /**
   * Get token by ID
   */
  getToken(tokenId: string): APIToken | undefined {
    return this.tokens.get(tokenId);
  }

  /**
   * List all tokens
   */
  listTokens(): Omit<APIToken, 'token' | 'hashedToken'>[] {
    return Array.from(this.tokens.values()).map(({ token, hashedToken, ...rest }) => rest);
  }
}

// Export singleton instance
export const apiTokenManager = new APITokenManager();

/**
 * Get API token from request
 */
export function getApiTokenFromRequest(request: Request): string | null {
  // Check Authorization header: Bearer <token>
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check X-API-Token header
  const apiTokenHeader = request.headers.get('x-api-token');
  if (apiTokenHeader) {
    return apiTokenHeader;
  }

  return null;
}

/**
 * Require API token authentication
 */
export function requireApiToken(request: Request, requiredScopes: string[] = []): {
  authenticated: boolean;
  tokenId?: string;
  scopes?: string[];
  error?: string;
} {
  const token = getApiTokenFromRequest(request);
  
  if (!token) {
    return { authenticated: false, error: 'Missing API token' };
  }

  const verification = apiTokenManager.verifyToken(token);
  
  if (!verification.valid) {
    return { 
      authenticated: false, 
      error: verification.expired ? 'Token expired' : 'Invalid token' 
    };
  }

  // Check scopes if required
  if (requiredScopes.length > 0 && verification.scopes) {
    const hasRequiredScopes = requiredScopes.every(scope => 
      verification.scopes!.includes(scope)
    );
    
    if (!hasRequiredScopes) {
      return { authenticated: false, error: 'Insufficient permissions' };
    }
  }

  return {
    authenticated: true,
    tokenId: verification.tokenId,
    scopes: verification.scopes,
  };
}

