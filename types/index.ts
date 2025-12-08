export type ProviderId = 'openai' | 'anthropic' | 'google' | 'cohere' | 'grok' | 'ollama';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  providerId?: ProviderId | 'moderator';
  timestamp: Date;
  error?: string;
  errorType?: string;
  model?: string;
  prompt?: string; // For moderator messages, stores the actual prompt sent to the moderator
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
  moderator?: {
    enabled: boolean;
    providerId: ProviderId;
    model: string;
  };
}

export interface ChatResponse {
  providerId: ProviderId | 'moderator';
  content: string;
  error?: string;
  model?: string;
  prompt?: string; // For moderator messages, stores the actual prompt sent to the moderator
}

