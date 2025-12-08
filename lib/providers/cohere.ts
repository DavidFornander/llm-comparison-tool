import { CohereClient } from 'cohere-ai';
import { LLMProvider, type RequestDetails, type ResponseDetails, type RequestResponseLog } from './base';
import type { ProviderId } from '@/types';

export class CohereProvider extends LLMProvider {
  readonly id: ProviderId = 'cohere';
  readonly name = 'Cohere';
  readonly displayName = 'Cohere';

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
      url: 'https://api.cohere.ai/v1/generate',
      method: 'POST',
      model,
      temperature,
      maxTokens,
      prompt: prompt.substring(0, 500),
      body: {
        model,
        prompt,
        temperature,
        max_tokens: maxTokens,
      },
    };

    const cohere = new CohereClient({
      token: apiKey,
    });

    try {
      const requestPayload = {
        model,
        prompt,
        temperature,
        maxTokens,
      };

      const response = await this.withTimeout(
        cohere.generate(requestPayload)
      );

      const responseDetails: ResponseDetails = {
        status: 200,
        data: response,
      };

      const text = response.generations[0]?.text;
      if (!text) {
        const requestResponseLog: RequestResponseLog = {
          request: requestDetails,
          response: responseDetails,
        };
        const technicalDetails = this.formatRequestResponseLog(requestResponseLog);
        const error = new Error('No response from Cohere');
        (error as Error & { technicalDetails?: string }).technicalDetails = technicalDetails;
        throw error;
      }

      return text.trim();
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

