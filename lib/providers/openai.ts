import OpenAI from 'openai';
import { LLMProvider, type RequestDetails, type ResponseDetails, type RequestResponseLog } from './base';
import type { ProviderId } from '@/types';

export class OpenAIProvider extends LLMProvider {
  readonly id: ProviderId = 'openai';
  readonly name = 'OpenAI';
  readonly displayName = 'OpenAI (GPT)';

  private shouldExcludeModel(id: string): boolean {
    const lower = id.toLowerCase();
    // Blacklist-only: exclude obvious non-chat/unsupported categories
    return (
      lower.includes('embedding') ||
      lower.includes('instruct') ||
      lower.includes('deprecated') ||
      lower.includes('audio') ||
      lower.includes('whisper') ||
      lower.includes('voice') ||
      lower.includes('tts')
    );
  }

  async fetchAvailableModels(apiKey: string): Promise<string[]> {
    if (!this.validateApiKey(apiKey)) {
      throw new Error('Invalid API key');
    }

    const openai = new OpenAI({
      apiKey: apiKey,
    });

    try {
      const models = await this.withTimeout(
        openai.models.list(),
        10000 // 10 second timeout for model listing
      );

      const filtered = models.data
        .filter((model) => !this.shouldExcludeModel(model.id))
        .map((model) => model.id)
        .sort();

      return filtered;
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

    const model = (options?.model as string) || 'gpt-3.5-turbo';
    const temperature = (options?.temperature as number) || 0.7;
    const maxTokens = (options?.maxTokens as number) || 1000;

    const requestDetails: RequestDetails = {
      url: 'https://api.openai.com/v1/chat/completions',
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

    const openai = new OpenAI({
      apiKey: apiKey,
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
        openai.chat.completions.create(requestPayload)
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
        const error = new Error('No response from OpenAI');
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

