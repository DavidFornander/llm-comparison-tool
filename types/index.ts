export type ProviderId = 'openai' | 'anthropic' | 'google' | 'cohere' | 'grok';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  providerId?: ProviderId;
  timestamp: Date;
  error?: string;
  errorType?: string;
}

export interface Provider {
  id: ProviderId;
  name: string;
  displayName: string;
  apiKey?: string;
  enabled: boolean;
}

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  displayName: string;
  defaultModel?: string;
  availableModels?: string[];
}

export interface ModelInfo {
  name: string;
  displayName?: string;
  supportedMethods?: string[];
}

export interface ChatState {
  messages: Message[];
  selectedProviders: ProviderId[];
  isLoading: boolean;
  error: string | null;
}

export interface ChatRequest {
  prompt: string;
  providerIds: ProviderId[];
  selectedModels?: Record<ProviderId, string>;
}

export interface ChatResponse {
  providerId: ProviderId;
  content: string;
  error?: string;
}

