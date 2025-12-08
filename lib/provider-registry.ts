import { LLMProvider } from './providers/base';
import { OpenAIProvider } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';
import { GoogleProvider } from './providers/google';
import { CohereProvider } from './providers/cohere';
import { GrokProvider } from './providers/grok';
import type { ProviderId, ProviderConfig } from '@/types';

class ProviderRegistry {
  private providers: Map<ProviderId, LLMProvider> = new Map();

  constructor() {
    // Register all providers
    this.register(new OpenAIProvider());
    this.register(new AnthropicProvider());
    this.register(new GoogleProvider());
    this.register(new CohereProvider());
    this.register(new GrokProvider());
  }

  /**
   * Register a provider
   */
  register(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Get a provider by ID
   */
  get(id: ProviderId): LLMProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Get all registered providers
   */
  getAll(): LLMProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get provider configurations
   */
  getConfigs(): ProviderConfig[] {
    return this.getAll().map((provider) => ({
      id: provider.id,
      name: provider.name,
      displayName: provider.displayName,
    }));
  }

  /**
   * Check if a provider is registered
   */
  has(id: ProviderId): boolean {
    return this.providers.has(id);
  }
}

// Export singleton instance
export const providerRegistry = new ProviderRegistry();

