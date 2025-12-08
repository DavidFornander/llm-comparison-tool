/**
 * Request Fingerprinting and Bot Detection
 */

import { createHash } from 'crypto';

export interface RequestFingerprint {
  hash: string;
  components: {
    ip: string;
    userAgent: string;
    acceptLanguage: string;
    acceptEncoding: string;
    connection: string;
  };
}

/**
 * Create a fingerprint from request headers
 */
export function createFingerprint(request: Request, ip: string): RequestFingerprint {
  const userAgent = request.headers.get('user-agent') || '';
  const acceptLanguage = request.headers.get('accept-language') || '';
  const acceptEncoding = request.headers.get('accept-encoding') || '';
  const connection = request.headers.get('connection') || '';

  const components = {
    ip,
    userAgent,
    acceptLanguage,
    acceptEncoding,
    connection,
  };

  // Create hash from components
  const fingerprintString = `${ip}|${userAgent}|${acceptLanguage}|${acceptEncoding}|${connection}`;
  const hash = createHash('sha256').update(fingerprintString).digest('hex');

  return {
    hash,
    components,
  };
}

/**
 * Detect if request might be from a bot
 */
export function detectBot(userAgent: string): {
  isBot: boolean;
  botType?: string;
} {
  if (!userAgent) {
    return { isBot: true, botType: 'no_user_agent' };
  }

  const lowerUA = userAgent.toLowerCase();

  // Common bot user agents
  const botPatterns = [
    { pattern: /bot|crawler|spider|scraper/i, type: 'generic_bot' },
    { pattern: /googlebot/i, type: 'googlebot' },
    { pattern: /bingbot/i, type: 'bingbot' },
    { pattern: /slurp/i, type: 'yahoo_bot' },
    { pattern: /duckduckbot/i, type: 'duckduckgo_bot' },
    { pattern: /baiduspider/i, type: 'baidu_bot' },
    { pattern: /yandexbot/i, type: 'yandex_bot' },
    { pattern: /sogou/i, type: 'sogou_bot' },
    { pattern: /exabot/i, type: 'exabot' },
    { pattern: /facebot/i, type: 'facebook_bot' },
    { pattern: /ia_archiver/i, type: 'alexa_bot' },
    { pattern: /curl|wget|python|java|go-http|node/i, type: 'script' },
  ];

  for (const { pattern, type } of botPatterns) {
    if (pattern.test(lowerUA)) {
      return { isBot: true, botType: type };
    }
  }

  // Check for suspicious patterns
  if (lowerUA.length < 10) {
    return { isBot: true, botType: 'suspicious_short_ua' };
  }

  // Check for missing common browser indicators
  const hasBrowserIndicators = 
    lowerUA.includes('mozilla') ||
    lowerUA.includes('chrome') ||
    lowerUA.includes('safari') ||
    lowerUA.includes('firefox') ||
    lowerUA.includes('edge') ||
    lowerUA.includes('opera');

  if (!hasBrowserIndicators && lowerUA.length > 0) {
    return { isBot: true, botType: 'no_browser_indicators' };
  }

  return { isBot: false };
}

/**
 * Analyze request patterns for anomalies
 */
export function analyzeRequestPattern(fingerprint: RequestFingerprint, requestHistory: RequestFingerprint[]): {
  isAnomalous: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  // Check for duplicate fingerprints (same user making many requests)
  const sameFingerprint = requestHistory.filter(f => f.hash === fingerprint.hash).length;
  if (sameFingerprint > 100) {
    reasons.push('excessive_requests_from_same_fingerprint');
  }

  // Check for rapid IP changes (potential proxy/VPN)
  const uniqueIPs = new Set(requestHistory.map(f => f.components.ip));
  if (uniqueIPs.size > 50) {
    reasons.push('rapid_ip_changes');
  }

  // Check for inconsistent user agents from same IP
  const sameIP = requestHistory.filter(f => f.components.ip === fingerprint.components.ip);
  const uniqueUAs = new Set(sameIP.map(f => f.components.userAgent));
  if (uniqueUAs.size > 10) {
    reasons.push('multiple_user_agents_from_same_ip');
  }

  return {
    isAnomalous: reasons.length > 0,
    reasons,
  };
}

/**
 * Get request fingerprint from request
 */
export function getRequestFingerprint(request: Request, ip: string): RequestFingerprint {
  return createFingerprint(request, ip);
}

