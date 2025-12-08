import { LLMProvider, type RequestDetails, type ResponseDetails, type RequestResponseLog } from './base';
import type { ProviderId } from '@/types';
import config from '@/lib/config';

interface OllamaModel {
  name: string;
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

interface OllamaChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class OllamaProvider extends LLMProvider {
  readonly id: ProviderId = 'ollama';
  readonly name = 'Ollama';
  readonly displayName = 'Ollama (Local)';
  readonly requiresApiKey = false; // Ollama local instances don't require API keys

  private getBaseUrl(): string {
    return (config as any).ollamaBaseUrl || 'http://localhost:11434';
  }

  /**
   * Override validateApiKey to allow empty/optional keys for local Ollama instances
   */
  validateApiKey(apiKey: string): boolean {
    // Ollama local instances don't require API keys
    // Allow empty string or any non-empty string (for remote instances with auth)
    return apiKey !== undefined && apiKey !== null;
  }

  async fetchAvailableModels(apiKey: string): Promise<string[]> {
    // Note: apiKey is optional for local Ollama, but we still validate it's not null/undefined
    if (!this.validateApiKey(apiKey)) {
      throw new Error('Invalid API key');
    }

    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/api/tags`;
    
    const requestDetails: RequestDetails = {
      url,
      method: 'GET',
      headers: this.buildHeaders(apiKey),
    };

    try {
      const response = await this.withTimeout(
        fetch(url, {
          method: 'GET',
          headers: this.buildHeaders(apiKey),
        }),
        10000 // 10 second timeout for model listing
      );

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const responseDetails: ResponseDetails = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      };

      if (!response.ok) {
        let responseBody: unknown;
        try {
          responseBody = await response.json();
          responseDetails.body = responseBody;
        } catch {
          try {
            responseBody = await response.text();
            responseDetails.body = responseBody;
          } catch {
            // Couldn't read response body
          }
        }

        const requestResponseLog: RequestResponseLog = {
          request: requestDetails,
          response: responseDetails,
        };
        const technicalDetails = this.formatRequestResponseLog(requestResponseLog);

        if (response.status === 401 || response.status === 403) {
          const error = new Error('Invalid API key or authentication failed');
          (error as Error & { technicalDetails?: string }).technicalDetails = technicalDetails;
          throw error;
        }
        
        if (response.status === 0 || response.status === 500) {
          const error = new Error('Cannot connect to Ollama. Make sure Ollama is running and accessible.');
          (error as Error & { technicalDetails?: string }).technicalDetails = technicalDetails;
          throw error;
        }

        const error = new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
        (error as Error & { technicalDetails?: string }).technicalDetails = technicalDetails;
        throw error;
      }

      const data: OllamaTagsResponse = await response.json();
      responseDetails.body = data;

      if (!data.models || !Array.isArray(data.models)) {
        return [];
      }

      // Extract model names and sort them
      const modelNames = data.models
        .map((model) => model.name)
        .filter((name): name is string => Boolean(name))
        .sort();

      return modelNames;
    } catch (error) {
      // Handle timeout errors
      if (error instanceof Error && error.message.includes('timeout')) {
        const requestResponseLog: RequestResponseLog = {
          request: requestDetails,
        };
        const technicalDetails = this.formatRequestResponseLog(requestResponseLog);
        const timeoutError = new Error('Request to Ollama timed out. Make sure Ollama is running.');
        (timeoutError as Error & { technicalDetails?: string }).technicalDetails = technicalDetails;
        throw timeoutError;
      }
      
      // Handle network/connection errors (ECONNREFUSED, ENOTFOUND, etc.)
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        const errorName = error.name.toLowerCase();
        
        // Check for common network error patterns
        if (
          errorMessage.includes('failed to fetch') ||
          errorMessage.includes('networkerror') ||
          errorMessage.includes('network error') ||
          errorMessage.includes('connection') ||
          errorMessage.includes('econnrefused') ||
          errorMessage.includes('enotfound') ||
          errorMessage.includes('eai_again') ||
          errorName.includes('typeerror') ||
          errorName.includes('networkerror')
        ) {
          const requestResponseLog: RequestResponseLog = {
            request: requestDetails,
          };
          const technicalDetails = this.formatRequestResponseLog(requestResponseLog);
          const connectionError = new Error(`Cannot connect to Ollama at ${baseUrl}. Make sure Ollama is running and accessible.`);
          (connectionError as Error & { technicalDetails?: string }).technicalDetails = technicalDetails;
          throw connectionError;
        }
      }
      
      throw error;
    }
  }

  async generateResponse(
    prompt: string,
    apiKey: string,
    options?: Record<string, unknown>
  ): Promise<string> {
    if (!this.validateApiKey(apiKey)) {
      throw new Error('Invalid API key');
    }

    const model = options?.model as string;
    if (!model) {
      throw new Error('Model name is required. Please select a model in the UI or set a default model in settings.');
    }

    const temperature = (options?.temperature as number) || 0.7;
    const maxTokens = (options?.maxTokens as number) || 8192;

    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/api/chat`;

    const requestBody: OllamaChatRequest = {
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      stream: false,
      options: {
        temperature,
        num_predict: maxTokens,
      },
    };

    const requestDetails: RequestDetails = {
      url,
      method: 'POST',
      model,
      temperature,
      maxTokens,
      prompt: prompt.substring(0, 500),
      headers: this.buildHeaders(apiKey),
      body: requestBody,
    };

    try {
      const response = await this.withTimeout(
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.buildHeaders(apiKey),
          },
          body: JSON.stringify(requestBody),
        }),
        60000 // 60 second timeout for chat completion
      );

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const responseDetails: ResponseDetails = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      };

      if (!response.ok) {
        let responseBody: unknown;
        try {
          responseBody = await response.json();
          responseDetails.body = responseBody;
        } catch {
          try {
            responseBody = await response.text();
            responseDetails.body = responseBody;
          } catch {
            // Couldn't read response body
          }
        }

        const requestResponseLog: RequestResponseLog = {
          request: requestDetails,
          response: responseDetails,
        };
        const technicalDetails = this.formatRequestResponseLog(requestResponseLog);

        if (response.status === 401 || response.status === 403) {
          const error = new Error('Invalid API key or authentication failed');
          (error as Error & { technicalDetails?: string }).technicalDetails = technicalDetails;
          throw error;
        }

        if (response.status === 404) {
          const error = new Error(`Model "${model}" not found. Make sure the model is pulled: ollama pull ${model}`);
          (error as Error & { technicalDetails?: string }).technicalDetails = technicalDetails;
          throw error;
        }

        if (response.status === 0 || response.status === 500) {
          const error = new Error('Cannot connect to Ollama. Make sure Ollama is running and accessible.');
          (error as Error & { technicalDetails?: string }).technicalDetails = technicalDetails;
          throw error;
        }

        const error = new Error(`Failed to generate response: ${response.status} ${response.statusText}`);
        (error as Error & { technicalDetails?: string }).technicalDetails = technicalDetails;
        throw error;
      }

      const data: OllamaChatResponse = await response.json();
      responseDetails.body = data;

      const content = data.message?.content;
      if (!content) {
        const requestResponseLog: RequestResponseLog = {
          request: requestDetails,
          response: responseDetails,
        };
        const technicalDetails = this.formatRequestResponseLog(requestResponseLog);
        const error = new Error('No response from Ollama');
        (error as Error & { technicalDetails?: string }).technicalDetails = technicalDetails;
        throw error;
      }

      return content;
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        const requestResponseLog: RequestResponseLog = {
          request: requestDetails,
        };
        const technicalDetails = this.formatRequestResponseLog(requestResponseLog);
        const timeoutError = new Error('Request to Ollama timed out. Make sure Ollama is running.');
        (timeoutError as Error & { technicalDetails?: string }).technicalDetails = technicalDetails;
        throw timeoutError;
      }

      let errorResponseDetails: ResponseDetails | undefined;
      
      try {
        if (error && typeof error === 'object') {
          const errorObj = error as Record<string, unknown>;
          if (errorObj.status) {
            errorResponseDetails = {
              status: errorObj.status as number,
              statusText: errorObj.statusText as string,
              body: errorObj.message || errorObj.error || errorObj,
            };
          } else if (errorObj.response) {
            const response = errorObj.response as Record<string, unknown>;
            errorResponseDetails = {
              status: response.status as number,
              statusText: response.statusText as string,
              body: response.data || response.body || response,
            };
          }
        }
      } catch {
        // Ignore errors extracting error details
      }

      const requestResponseLog: RequestResponseLog = {
        request: requestDetails,
        response: errorResponseDetails,
      };
      const technicalDetails = this.formatRequestResponseLog(requestResponseLog);
      const enhancedError = new Error(this.handleError(error));
      (enhancedError as Error & { technicalDetails?: string }).technicalDetails = technicalDetails;
      throw enhancedError;
    }
  }

  /**
   * Build headers for requests, including optional Authorization header if API key is provided
   */
  private buildHeaders(apiKey: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // If API key is provided and not empty, add Authorization header
    // This is useful for remote Ollama instances that require authentication
    if (apiKey && apiKey.trim().length > 0) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    return headers;
  }
}

