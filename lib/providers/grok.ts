import OpenAI from 'openai';
import { LLMProvider, type RequestDetails, type ResponseDetails, type RequestResponseLog } from './base';
import type { ProviderId } from '@/types';

export class GrokProvider extends LLMProvider {
  readonly id: ProviderId = 'grok';
  readonly name = 'Grok';
  readonly displayName = 'Grok (xAI)';

  async fetchAvailableModels(apiKey: string): Promise<string[]> {
    if (!this.validateApiKey(apiKey)) {
      throw new Error('Invalid API key');
    }

    // xAI's API is OpenAI-compatible, so we can use the OpenAI SDK
    const grok = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.x.ai/v1',
    });

    try {
      const models = await this.withTimeout(
        grok.models.list(),
        10000 // 10 second timeout for model listing
      );

      // Filter for Grok chat completion models
      // Grok models typically include: grok-beta, grok-2, grok-3, etc.
      const grokModels = models.data
        .filter((model) => {
          const id = model.id.toLowerCase();
          // Include Grok models that support chat completions
          return (
            id.startsWith('grok-') &&
            !id.includes('deprecated') && // Exclude deprecated models
            model.owned_by === 'xai' // Only include xAI-owned models
          );
        })
        .map((model) => model.id)
        .sort();

      return grokModels;
    } catch (error) {
      throw new Error(this.handleError(error));
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

    const requestDetails: RequestDetails = {
      url: 'https://api.x.ai/v1/chat/completions',
      method: 'POST',
      model,
      temperature,
      maxTokens,
      prompt: prompt.substring(0, 500),
      body: {
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature,
        max_tokens: maxTokens,
      },
    };

    // xAI's API is OpenAI-compatible, so we can use the OpenAI SDK with custom baseURL
    const grok = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.x.ai/v1',
    });

    try {
      const requestPayload = {
        model,
        messages: [
          {
            role: 'user' as const,
            content: prompt,
          },
        ],
        temperature,
        max_tokens: maxTokens,
      };

      const completion = await this.withTimeout(
        grok.chat.completions.create(requestPayload)
      );

      const responseDetails: ResponseDetails = {
        status: 200,
        data: completion,
      };

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        const requestResponseLog: RequestResponseLog = {
          request: requestDetails,
          response: responseDetails,
        };
        const technicalDetails = this.formatRequestResponseLog(requestResponseLog);
        const error = new Error('No response from Grok');
        (error as Error & { technicalDetails?: string }).technicalDetails = technicalDetails;
        throw error;
      }

      return content;
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

