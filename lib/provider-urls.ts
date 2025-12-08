import type { ProviderId } from '@/types';

/**
 * Provider API documentation and key management URLs
 */
export const providerUrls: Record<ProviderId, { apiDocs: string; apiKeys: string }> = {
  openai: {
    apiDocs: 'https://platform.openai.com/docs',
    apiKeys: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    apiDocs: 'https://docs.anthropic.com',
    apiKeys: 'https://console.anthropic.com/',
  },
  google: {
    apiDocs: 'https://ai.google.dev/docs',
    apiKeys: 'https://makersuite.google.com/app/apikey',
  },
  cohere: {
    apiDocs: 'https://docs.cohere.com',
    apiKeys: 'https://dashboard.cohere.com/api-keys',
  },
  grok: {
    apiDocs: 'https://docs.x.ai',
    apiKeys: 'https://console.x.ai/',
  },
};

