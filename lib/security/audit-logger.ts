/**
 * Audit Logging System
 */

export enum SecurityEventType {
  AUTH_ATTEMPT = 'auth_attempt',
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILURE = 'auth_failure',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  CSRF_FAILURE = 'csrf_failure',
  INVALID_INPUT = 'invalid_input',
  API_KEY_USAGE = 'api_key_usage',
  IP_BLOCKED = 'ip_blocked',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  ERROR = 'error',
}

export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface AuditLogEntry {
  timestamp: Date;
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  ipAddress: string;
  userAgent?: string;
  path?: string;
  method?: string;
  details?: Record<string, unknown>;
  userId?: string;
}

class AuditLogger {
  private logs: AuditLogEntry[] = [];
  private maxLogs: number;
  private enabled: boolean;

  constructor() {
    this.maxLogs = parseInt(process.env.AUDIT_LOG_MAX_ENTRIES || '10000', 10);
    this.enabled = process.env.AUDIT_LOGGING_ENABLED !== 'false';
  }

  /**
   * Log a security event
   */
  log(entry: Omit<AuditLogEntry, 'timestamp'>): void {
    if (!this.enabled) {
      return;
    }

    const logEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date(),
    };

    this.logs.push(logEntry);

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Output to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[AUDIT]', JSON.stringify(logEntry));
    }

    // In production, you might want to send to external logging service
    // Example: sendToLoggingService(logEntry);
  }

  /**
   * Get logs filtered by criteria
   */
  getLogs(filters?: {
    eventType?: SecurityEventType;
    severity?: SecuritySeverity;
    ipAddress?: string;
    startTime?: Date;
    endTime?: Date;
  }): AuditLogEntry[] {
    let filtered = [...this.logs];

    if (filters?.eventType) {
      filtered = filtered.filter(log => log.eventType === filters.eventType);
    }

    if (filters?.severity) {
      filtered = filtered.filter(log => log.severity === filters.severity);
    }

    if (filters?.ipAddress) {
      filtered = filtered.filter(log => log.ipAddress === filters.ipAddress);
    }

    if (filters?.startTime) {
      filtered = filtered.filter(log => log.timestamp >= filters.startTime!);
    }

    if (filters?.endTime) {
      filtered = filtered.filter(log => log.timestamp <= filters.endTime!);
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get recent logs for an IP address
   */
  getRecentLogsForIP(ipAddress: string, minutes: number = 60): AuditLogEntry[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.getLogs({
      ipAddress,
      startTime: cutoff,
    });
  }

  /**
   * Check if IP has suspicious activity
   */
  hasSuspiciousActivity(ipAddress: string, minutes: number = 60): boolean {
    const recentLogs = this.getRecentLogsForIP(ipAddress, minutes);
    
    // Check for multiple rate limit violations
    const rateLimitViolations = recentLogs.filter(
      log => log.eventType === SecurityEventType.RATE_LIMIT_EXCEEDED
    ).length;

    // Check for multiple CSRF failures
    const csrfFailures = recentLogs.filter(
      log => log.eventType === SecurityEventType.CSRF_FAILURE
    ).length;

    // Check for multiple auth failures
    const authFailures = recentLogs.filter(
      log => log.eventType === SecurityEventType.AUTH_FAILURE
    ).length;

    // Consider suspicious if:
    // - More than 5 rate limit violations
    // - More than 3 CSRF failures
    // - More than 10 auth failures
    return rateLimitViolations > 5 || csrfFailures > 3 || authFailures > 10;
  }

  /**
   * Clear old logs
   */
  clearOldLogs(olderThanDays: number = 30): void {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    this.logs = this.logs.filter(log => log.timestamp > cutoff);
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();

// Helper functions for common logging scenarios
export function logRateLimitExceeded(ipAddress: string, path: string, userAgent?: string): void {
  auditLogger.log({
    eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
    severity: SecuritySeverity.MEDIUM,
    ipAddress,
    path,
    userAgent,
    details: { message: 'Rate limit exceeded' },
  });
}

export function logCsrfFailure(ipAddress: string, path: string, userAgent?: string): void {
  auditLogger.log({
    eventType: SecurityEventType.CSRF_FAILURE,
    severity: SecuritySeverity.HIGH,
    ipAddress,
    path,
    userAgent,
    details: { message: 'CSRF token validation failed' },
  });
}

export function logInvalidInput(ipAddress: string, path: string, reason: string, userAgent?: string): void {
  auditLogger.log({
    eventType: SecurityEventType.INVALID_INPUT,
    severity: SecuritySeverity.LOW,
    ipAddress,
    path,
    userAgent,
    details: { reason },
  });
}

export function logApiKeyUsage(ipAddress: string, providerId: string, success: boolean, userAgent?: string): void {
  auditLogger.log({
    eventType: SecurityEventType.API_KEY_USAGE,
    severity: success ? SecuritySeverity.LOW : SecuritySeverity.MEDIUM,
    ipAddress,
    userAgent,
    details: { providerId, success },
  });
}

export function logSuspiciousActivity(ipAddress: string, reason: string, path?: string, userAgent?: string): void {
  auditLogger.log({
    eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
    severity: SecuritySeverity.HIGH,
    ipAddress,
    path,
    userAgent,
    details: { reason },
  });
}

export function logProviderError(
  ipAddress: string,
  providerId: string,
  error: Error | unknown,
  details?: {
    model?: string;
    promptLength?: number;
    userAgent?: string;
    path?: string;
  }
): void {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorStack = error instanceof Error ? error.stack : undefined;
  const technicalDetails = (error as Error & { technicalDetails?: string })?.technicalDetails;
  
  auditLogger.log({
    eventType: SecurityEventType.ERROR,
    severity: SecuritySeverity.MEDIUM,
    ipAddress,
    path: details?.path,
    userAgent: details?.userAgent,
    details: {
      providerId,
      errorMessage,
      errorStack: errorStack?.substring(0, 500), // Limit stack trace length
      technicalDetails,
      model: details?.model,
      promptLength: details?.promptLength,
    },
  });
}

