import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider, type RequestDetails, type ResponseDetails, type RequestResponseLog } from './base';
import type { ProviderId } from '@/types';

export class AnthropicProvider extends LLMProvider {
  readonly id: ProviderId = 'anthropic';
  readonly name = 'Anthropic';
  readonly displayName = 'Anthropic (Claude)';

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

    const requestDetails: RequestDetails = {
      url: 'https://api.anthropic.com/v1/messages',
      method: 'POST',
      model,
      temperature,
      maxTokens,
      prompt: prompt.substring(0, 500),
      body: {
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      },
    };

    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    try {
      const requestPayload = {
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          {
            role: 'user' as const,
            content: prompt,
          },
        ],
      };

      const message = await this.withTimeout(
        anthropic.messages.create(requestPayload)
      );

      const responseDetails: ResponseDetails = {
        status: 200,
        data: message,
      };

      const content = message.content[0];
      if (content.type !== 'text') {
        const requestResponseLog: RequestResponseLog = {
          request: requestDetails,
          response: responseDetails,
        };
        const technicalDetails = this.formatRequestResponseLog(requestResponseLog);
        const error = new Error('Unexpected response type from Anthropic');
        (error as Error & { technicalDetails?: string }).technicalDetails = technicalDetails;
        throw error;
      }

      return content.text;
    } catch (error) {
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
}

