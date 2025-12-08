/**
 * IP Filtering and Access Control
 */

import { rateLimiter } from './rate-limiter';

interface IPFilterConfig {
  whitelist: string[];
  blacklist: string[];
  enableDynamicBlocking: boolean;
  maxViolationsBeforeBlock: number;
  blockDurationMs: number;
}

interface IPViolation {
  ip: string;
  violations: number;
  blockedUntil: Date | null;
}

class IPFilter {
  private config: IPFilterConfig;
  private violations: Map<string, IPViolation> = new Map();
  private dynamicBlocks: Map<string, Date> = new Map();

  constructor() {
    this.config = {
      whitelist: process.env.IP_WHITELIST?.split(',').map(ip => ip.trim()).filter(Boolean) || [],
      blacklist: process.env.IP_BLACKLIST?.split(',').map(ip => ip.trim()).filter(Boolean) || [],
      enableDynamicBlocking: process.env.ENABLE_DYNAMIC_IP_BLOCKING !== 'false',
      maxViolationsBeforeBlock: parseInt(process.env.MAX_VIOLATIONS_BEFORE_BLOCK || '5', 10),
      blockDurationMs: parseInt(process.env.IP_BLOCK_DURATION_MS || '3600000', 10), // 1 hour default
    };
  }

  /**
   * Check if IP is allowed
   */
  isAllowed(ip: string): { allowed: boolean; reason?: string } {
    // Check whitelist first
    if (this.config.whitelist.length > 0) {
      if (!this.config.whitelist.includes(ip)) {
        return { allowed: false, reason: 'IP not in whitelist' };
      }
    }

    // Check blacklist
    if (this.config.blacklist.includes(ip)) {
      return { allowed: false, reason: 'IP is blacklisted' };
    }

    // Check dynamic blocks
    if (this.config.enableDynamicBlocking) {
      const blockUntil = this.dynamicBlocks.get(ip);
      if (blockUntil && blockUntil > new Date()) {
        return { allowed: false, reason: 'IP is temporarily blocked' };
      } else if (blockUntil && blockUntil <= new Date()) {
        // Block expired, remove it
        this.dynamicBlocks.delete(ip);
      }
    }

    return { allowed: true };
  }

  /**
   * Record a violation for an IP
   */
  recordViolation(ip: string, reason: string): void {
    if (!this.config.enableDynamicBlocking) {
      return;
    }

    const violation = this.violations.get(ip) || {
      ip,
      violations: 0,
      blockedUntil: null,
    };

    violation.violations += 1;

    // Block if exceeds threshold
    if (violation.violations >= this.config.maxViolationsBeforeBlock) {
      const blockUntil = new Date(Date.now() + this.config.blockDurationMs);
      this.dynamicBlocks.set(ip, blockUntil);
      violation.blockedUntil = blockUntil;
      violation.violations = 0; // Reset after blocking
    }

    this.violations.set(ip, violation);
  }

  /**
   * Manually block an IP
   */
  blockIP(ip: string, durationMs?: number): void {
    const duration = durationMs || this.config.blockDurationMs;
    const blockUntil = new Date(Date.now() + duration);
    this.dynamicBlocks.set(ip, blockUntil);
  }

  /**
   * Unblock an IP
   */
  unblockIP(ip: string): void {
    this.dynamicBlocks.delete(ip);
    this.violations.delete(ip);
  }

  /**
   * Get IP status
   */
  getIPStatus(ip: string): {
    allowed: boolean;
    violations: number;
    blockedUntil: Date | null;
    isWhitelisted: boolean;
    isBlacklisted: boolean;
  } {
    const check = this.isAllowed(ip);
    const violation = this.violations.get(ip);
    const blockUntil = this.dynamicBlocks.get(ip) || null;

    return {
      allowed: check.allowed,
      violations: violation?.violations || 0,
      blockedUntil: blockUntil,
      isWhitelisted: this.config.whitelist.includes(ip),
      isBlacklisted: this.config.blacklist.includes(ip),
    };
  }

  /**
   * Clean up expired blocks
   */
  cleanup(): void {
    const now = new Date();
    for (const [ip, blockUntil] of this.dynamicBlocks.entries()) {
      if (blockUntil <= now) {
        this.dynamicBlocks.delete(ip);
        this.violations.delete(ip);
      }
    }
  }
}

// Export singleton instance
export const ipFilter = new IPFilter();

// Clean up expired blocks every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    ipFilter.cleanup();
  }, 5 * 60 * 1000);
}

/**
 * Get client IP from request
 */
export function getClientIP(request: Request): string {
  // This should match the implementation in rate-limiter
  // Check various headers for IP address
  const headers = request.headers;
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback
  return 'unknown';
}

