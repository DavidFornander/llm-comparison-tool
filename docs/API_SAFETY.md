# API Safety and Security Guidelines

## Overview

This document outlines security best practices for using the LLM Comparison Tool, particularly regarding API key management and safe usage of LLM provider APIs.

## API Key Security

### Current Implementation

The application currently stores API keys in browser **localStorage**, which has significant security limitations:

- **Not Encrypted**: Keys are stored in plain text
- **Accessible to JavaScript**: Any script running on the page can access keys
- **XSS Vulnerable**: Cross-site scripting attacks can steal keys
- **Browser Extensions**: Extensions with appropriate permissions can read keys

### ⚠️ Security Warning

**DO NOT use this application in production without implementing proper security measures.**

### Best Practices for API Key Storage

#### For Development/Personal Use

1. **Use Separate API Keys**: Create dedicated API keys for testing/development
2. **Set Usage Limits**: Configure spending limits on your API keys
3. **Monitor Usage**: Regularly check API usage and billing
4. **Rotate Keys**: Periodically rotate API keys
5. **Use Read-Only Keys**: If available, use keys with minimal permissions

#### For Production Use

1. **Server-Side Storage**: Store API keys on the server, never in the client
2. **Environment Variables**: Use environment variables for API keys
3. **Encryption**: Encrypt API keys at rest
4. **Key Management Services**: Use services like:
   - AWS Secrets Manager
   - HashiCorp Vault
   - Google Secret Manager
   - Azure Key Vault
5. **API Gateway**: Use an API gateway to proxy requests and hide keys
6. **Access Control**: Implement proper authentication and authorization

### Recommended Architecture for Production

```
Client → Authenticated Request → Server API → Secure Key Storage → LLM Provider
```

The server should:
- Authenticate users
- Retrieve API keys from secure storage
- Make LLM API calls server-side
- Never expose API keys to the client

## Rate Limiting

### Provider Rate Limits

Each LLM provider has different rate limits:

#### OpenAI
- **Free Tier**: Limited requests per minute
- **Paid Tier**: Higher limits based on tier
- **Rate Limit Headers**: Check `x-ratelimit-*` headers in responses

#### Anthropic
- **Rate Limits**: Vary by model and tier
- **Concurrent Requests**: Limited concurrent requests
- **Quota Management**: Monitor usage in Anthropic Console

#### Google Gemini
- **Free Tier**: 60 requests per minute
- **Paid Tier**: Higher limits available
- **Quota Exceeded**: Returns 429 status code

#### Cohere
- **Rate Limits**: Based on tier and model
- **Request Limits**: Check Cohere dashboard for limits

#### Grok (xAI)
- **Rate Limits**: Vary by subscription tier
- **API Access**: Requires xAI developer account
- **Rate Limit Headers**: Check xAI API documentation for current limits

### Implementing Rate Limiting

1. **Client-Side Throttling**: Add delays between requests
2. **Server-Side Queuing**: Queue requests to respect rate limits
3. **Exponential Backoff**: Retry with increasing delays
4. **Rate Limit Headers**: Parse and respect provider rate limit headers

### Example Rate Limiting Strategy

```typescript
// Simple rate limiter
class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter(
      time => now - time < this.windowMs
    );

    if (this.requests.length >= this.maxRequests) {
      const oldest = this.requests[0];
      const waitTime = this.windowMs - (now - oldest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.requests.push(Date.now());
  }
}
```

## Cost Management

### Understanding Costs

LLM API costs are typically based on:
- **Tokens**: Input and output tokens
- **Model**: Different models have different pricing
- **Requests**: Some providers charge per request

### Cost Optimization Strategies

1. **Set Spending Limits**: Configure hard limits on API keys
2. **Monitor Usage**: Regularly check usage dashboards
3. **Use Efficient Models**: Choose models that balance cost and quality
4. **Cache Responses**: Cache similar queries when possible
5. **Batch Requests**: Combine multiple queries when supported
6. **Token Limits**: Set appropriate max token limits

### Provider Pricing (Approximate)

- **OpenAI GPT-3.5**: ~$0.002 per 1K tokens
- **OpenAI GPT-4**: ~$0.03-0.06 per 1K tokens
- **Anthropic Claude**: ~$0.003-0.015 per 1K tokens
- **Google Gemini**: Free tier available, paid pricing varies
- **Cohere**: Pricing varies by model and tier
- **Grok (xAI)**: Pricing varies by subscription tier

*Prices are approximate and subject to change. Check provider websites for current pricing.*

## Error Handling

### Common API Errors

1. **401 Unauthorized**: Invalid or expired API key
2. **429 Too Many Requests**: Rate limit exceeded
3. **500 Internal Server Error**: Provider-side error
4. **503 Service Unavailable**: Provider service down
5. **Quota Exceeded**: Usage limit reached

### Error Handling Best Practices

1. **Graceful Degradation**: Handle errors without crashing
2. **User-Friendly Messages**: Translate technical errors to user-friendly messages
3. **Retry Logic**: Implement exponential backoff for retries
4. **Logging**: Log errors for debugging (without exposing sensitive data)
5. **Fallback**: Provide fallback options when providers fail

## Data Privacy

### What Data is Sent to Providers

- **User Prompts**: All prompts are sent to selected providers
- **No Personal Data**: Avoid sending PII (Personally Identifiable Information)
- **No Sensitive Data**: Don't send passwords, API keys, or secrets

### Data Retention

- **Provider Logs**: Providers may log requests for debugging
- **Review Policies**: Check each provider's data retention policy
- **Opt-Out**: Some providers allow opting out of logging

### Recommendations

1. **Sanitize Inputs**: Remove sensitive information before sending
2. **Use Privacy Modes**: Enable privacy modes when available
3. **Review Provider Policies**: Understand how providers handle data
4. **Compliance**: Ensure compliance with GDPR, HIPAA, etc. if applicable

## Best Practices Summary

1. ✅ **Never commit API keys to version control**
2. ✅ **Use environment variables for API keys**
3. ✅ **Implement rate limiting**
4. ✅ **Set spending limits**
5. ✅ **Monitor usage regularly**
6. ✅ **Use separate keys for development/production**
7. ✅ **Rotate keys periodically**
8. ✅ **Implement proper error handling**
9. ✅ **Respect provider rate limits**
10. ✅ **Sanitize user inputs**

## Additional Resources

- [OpenAI Security Best Practices](https://platform.openai.com/docs/guides/safety-best-practices)
- [Anthropic Security Guide](https://docs.anthropic.com/claude/docs/security)
- [Google AI Safety](https://ai.google/responsibilities/safety-security/)
- [Cohere Security](https://docs.cohere.com/docs/security)

## Reporting Security Issues

If you discover a security vulnerability, please:
1. Do not open a public issue
2. Contact the maintainers privately
3. Provide detailed information about the vulnerability
4. Allow time for a fix before public disclosure

