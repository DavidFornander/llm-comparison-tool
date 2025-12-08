/**
 * Environment variable configuration and validation
 */

interface Config {
  nodeEnv: string;
  port: number;
  appUrl: string;
  apiKeys: {
    openai?: string;
    anthropic?: string;
    google?: string;
    cohere?: string;
    grok?: string;
    ollama?: string;
  };
  ollamaBaseUrl: string;
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    maxPromptLength: number;
  };
  security: {
    allowedOrigins: string[];
    enableCors: boolean;
    csrfSecret: string;
    apiTokenSecret: string;
    auditLoggingEnabled: boolean;
    auditLogMaxEntries: number;
    enableDynamicIPBlocking: boolean;
    maxViolationsBeforeBlock: number;
    ipBlockDurationMs: number;
  };
  request: {
    maxSizeMB: number;
    timeoutMs: number;
  };
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(`Invalid number for ${key}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

function getEnvArray(key: string, defaultValue: string[]): string[] {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export const config: Config = {
  nodeEnv: getEnv('NODE_ENV', 'development'),
  port: getEnvNumber('PORT', 3000),
  appUrl: getEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
  apiKeys: {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    google: process.env.GOOGLE_API_KEY,
    cohere: process.env.COHERE_API_KEY,
    grok: process.env.GROK_API_KEY,
    ollama: process.env.OLLAMA_API_KEY,
  },
  ollamaBaseUrl: getEnv('OLLAMA_BASE_URL', 'http://localhost:11434'),
  rateLimit: {
    windowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 60000),
    maxRequests: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 10),
    maxPromptLength: getEnvNumber('RATE_LIMIT_MAX_PROMPT_LENGTH', 10000),
  },
  security: {
    allowedOrigins: getEnvArray('ALLOWED_ORIGINS', ['http://localhost:3000', 'http://localhost:3001']),
    enableCors: getEnvBoolean('ENABLE_CORS', true),
    csrfSecret: getEnv('CSRF_SECRET', 'change-me-in-production'),
    apiTokenSecret: getEnv('API_TOKEN_SECRET', 'change-me-in-production'),
    auditLoggingEnabled: getEnvBoolean('AUDIT_LOGGING_ENABLED', true),
    auditLogMaxEntries: getEnvNumber('AUDIT_LOG_MAX_ENTRIES', 10000),
    enableDynamicIPBlocking: getEnvBoolean('ENABLE_DYNAMIC_IP_BLOCKING', true),
    maxViolationsBeforeBlock: getEnvNumber('MAX_VIOLATIONS_BEFORE_BLOCK', 5),
    ipBlockDurationMs: getEnvNumber('IP_BLOCK_DURATION_MS', 3600000),
  },
  request: {
    maxSizeMB: getEnvNumber('MAX_REQUEST_SIZE_MB', 10),
    timeoutMs: getEnvNumber('REQUEST_TIMEOUT_MS', 60000),
  },
};

// Validate configuration on module load
if (config.nodeEnv === 'production') {
  // In production, log warnings for missing optional configs
  if (!config.apiKeys.openai && !config.apiKeys.anthropic && !config.apiKeys.google && !config.apiKeys.cohere && !config.apiKeys.grok && !config.apiKeys.ollama) {
    console.warn('No server-side API keys configured. Client-side storage will be used.');
  }
}

export default config;

