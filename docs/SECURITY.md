# Security Documentation

This document outlines the security measures implemented in the LLM Comparison Tool and provides guidance for secure deployment.

## Security Features

### 1. Rate Limiting

The application implements rate limiting to prevent abuse and DDoS attacks:

- **Per-IP Rate Limiting**: Requests are rate-limited by client IP address
- **Configurable Limits**: Rate limits can be configured via environment variables
- **Default Limits**: 10 requests per 60 seconds per IP address
- **Rate Limit Headers**: Responses include rate limit information in headers:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `X-RateLimit-Reset`: Time when the rate limit resets
  - `Retry-After`: Seconds to wait before retrying (on 429 responses)

**Configuration:**
```env
RATE_LIMIT_WINDOW_MS=60000      # Time window in milliseconds
RATE_LIMIT_MAX_REQUESTS=10      # Maximum requests per window
```

### 2. Input Validation

All user inputs are validated and sanitized:

- **Prompt Validation**:
  - Must be a non-empty string
  - Maximum length: 10,000 characters (configurable)
  - Control characters removed (except newlines and tabs)
  - Null bytes removed

- **Provider ID Validation**:
  - Must be a valid provider ID (openai, anthropic, google, cohere)
  - Duplicate provider IDs are removed
  - At least one provider must be selected

- **Request Size Limits**:
  - Maximum request body size: 10MB (configurable)
  - Validated before processing

**Configuration:**
```env
RATE_LIMIT_MAX_PROMPT_LENGTH=10000  # Maximum prompt length
MAX_REQUEST_SIZE_MB=10               # Maximum request size in MB
```

### 3. Security Headers

The application sets security headers via Next.js middleware:

- **X-Content-Type-Options**: `nosniff` - Prevents MIME type sniffing
- **X-Frame-Options**: `DENY` - Prevents clickjacking
- **X-XSS-Protection**: `1; mode=block` - Enables XSS filtering
- **Referrer-Policy**: `strict-origin-when-cross-origin` - Controls referrer information
- **Content-Security-Policy**: Restricts resource loading
- **Strict-Transport-Security**: Enforced in production over HTTPS

### 4. CORS Configuration

Cross-Origin Resource Sharing (CORS) is configured for API routes:

- **Allowed Origins**: Configurable via `ALLOWED_ORIGINS` environment variable
- **Allowed Methods**: GET, POST, OPTIONS
- **Allowed Headers**: Content-Type
- **Preflight Support**: OPTIONS requests are handled automatically

**Configuration:**
```env
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
ENABLE_CORS=true
```

### 5. Error Handling

Error messages are sanitized to prevent information leakage:

- **Generic Error Messages**: Client-facing errors are generic
- **Detailed Logging**: Server-side logs contain detailed information (without sensitive data)
- **No Sensitive Data**: API keys, tokens, and credentials are never exposed in errors
- **Error Codes**: Use standard HTTP status codes

### 6. API Key Security

#### Current Implementation

**Client-Side Storage (Default):**
- API keys are stored in browser localStorage
- Keys are sent from client to server in request body
- **⚠️ Not recommended for production**

**Server-Side Storage (Recommended):**
- API keys can be stored as environment variables
- Keys never leave the server
- More secure for production deployments

**Configuration:**
```env
# Server-side API keys (optional)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
COHERE_API_KEY=...
```

#### Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** for server-side storage
3. **Rotate keys regularly**
4. **Use separate keys** for development and production
5. **Set spending limits** on API keys
6. **Monitor usage** regularly

### 7. Request Validation

All requests are validated before processing:

- **JSON Validation**: Request body must be valid JSON
- **Type Checking**: Strict type validation on all inputs
- **Size Limits**: Request size is validated
- **Timeout Protection**: Requests timeout after configured duration

**Configuration:**
```env
REQUEST_TIMEOUT_MS=60000  # Request timeout in milliseconds
```

## Security Recommendations

### For Development

1. Use client-side storage for quick testing
2. Set up environment variables for testing server-side storage
3. Use separate API keys for development
4. Enable CORS for local development

### For Production

1. **Use Server-Side API Keys**: Store API keys as environment variables
2. **Enable HTTPS**: Always use HTTPS in production
3. **Configure CORS**: Set `ALLOWED_ORIGINS` to your production domain
4. **Set Rate Limits**: Adjust rate limits based on expected traffic
5. **Monitor Logs**: Regularly review server logs for suspicious activity
6. **Keep Dependencies Updated**: Regularly update npm packages
7. **Use a Reverse Proxy**: Consider using nginx or similar for additional security
8. **Enable Firewall**: Restrict access to necessary ports only

### Environment Variables

Create a `.env.local` file (never commit this):

```env
# Server Configuration
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# API Keys (Server-Side)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
COHERE_API_KEY=...

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=10
RATE_LIMIT_MAX_PROMPT_LENGTH=10000

# Security
ALLOWED_ORIGINS=https://yourdomain.com
ENABLE_CORS=true

# Request Limits
MAX_REQUEST_SIZE_MB=10
REQUEST_TIMEOUT_MS=60000
```

## Security Checklist

Before deploying to production:

- [ ] API keys stored server-side (environment variables)
- [ ] HTTPS enabled
- [ ] CORS configured for production domain
- [ ] Rate limits configured appropriately
- [ ] Security headers enabled
- [ ] Error messages sanitized
- [ ] Input validation enabled
- [ ] Request size limits configured
- [ ] Environment variables documented
- [ ] `.env.local` added to `.gitignore`
- [ ] Dependencies updated
- [ ] Logging configured (without sensitive data)
- [ ] Monitoring set up

## Advanced Security Features

### CSRF Protection

The application implements CSRF (Cross-Site Request Forgery) protection:

- **CSRF Tokens**: All POST requests require a valid CSRF token
- **Token Generation**: Tokens are generated server-side and signed
- **Cookie-Based**: Tokens are stored in httpOnly cookies
- **Origin Validation**: Additional origin header validation

**Usage:**
1. Client requests CSRF token from `/api/csrf-token`
2. Token is automatically set in httpOnly cookie
3. Client includes token in `X-CSRF-Token` header for POST requests
4. Server validates token before processing request

### IP Filtering

IP-based access control:

- **Whitelisting**: Allow only specific IPs (optional)
- **Blacklisting**: Block known malicious IPs
- **Dynamic Blocking**: Automatically block IPs after repeated violations
- **Violation Tracking**: Track violations per IP

**Configuration:**
```env
IP_WHITELIST=192.168.1.1,10.0.0.1  # Optional, comma-separated
IP_BLACKLIST=1.2.3.4,5.6.7.8       # Comma-separated
ENABLE_DYNAMIC_IP_BLOCKING=true
MAX_VIOLATIONS_BEFORE_BLOCK=5
IP_BLOCK_DURATION_MS=3600000        # 1 hour
```

### Audit Logging

Comprehensive security event logging:

- **Event Types**: Authentication, rate limiting, CSRF failures, suspicious activity
- **Severity Levels**: Low, Medium, High, Critical
- **IP Tracking**: Track all events by IP address
- **Anomaly Detection**: Detect suspicious patterns

**Configuration:**
```env
AUDIT_LOGGING_ENABLED=true
AUDIT_LOG_MAX_ENTRIES=10000
```

### API Token Authentication

Programmatic access via API tokens:

- **Token Generation**: Generate secure API tokens
- **Token Scoping**: Limit tokens to specific operations
- **Token Expiration**: Optional expiration dates
- **Token Revocation**: Revoke tokens when needed

**Usage:**
```bash
# Create token
curl -X POST http://localhost:3000/api/auth/tokens \
  -H "Content-Type: application/json" \
  -d '{"name": "My Token", "scopes": ["read", "write"]}'

# Use token
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer llm_<token>" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello", "providerIds": ["openai"]}'
```

### Output Sanitization

LLM responses are sanitized to prevent XSS:

- **HTML Sanitization**: Remove dangerous HTML tags and attributes
- **Script Removal**: Strip script tags and event handlers
- **Content Filtering**: Detect and log malicious patterns
- **PII Detection**: Optional PII redaction

### Request Fingerprinting

Request fingerprinting for bot detection:

- **Fingerprint Creation**: Unique hash from request headers
- **Bot Detection**: Detect common bot user agents
- **Anomaly Detection**: Identify suspicious request patterns

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do not** open a public issue
2. Contact the maintainers privately
3. Provide detailed information about the vulnerability
4. Allow time for a fix before public disclosure

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)
- [API Security Best Practices](https://owasp.org/www-project-api-security/)

