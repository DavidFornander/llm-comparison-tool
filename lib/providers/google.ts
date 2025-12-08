import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMProvider, type RequestDetails, type ResponseDetails, type RequestResponseLog } from './base';
import type { ProviderId } from '@/types';

interface GoogleModel {
  name: string;
  supportedGenerationMethods?: string[];
  displayName?: string;
}

interface GoogleModelsResponse {
  models?: GoogleModel[];
}

export class GoogleProvider extends LLMProvider {
  readonly id: ProviderId = 'google';
  readonly name = 'Google';
  readonly displayName = 'Google (Gemini)';

  async fetchAvailableModels(apiKey: string): Promise<string[]> {
    if (!this.validateApiKey(apiKey)) {
      throw new Error('Invalid API key');
    }

    const url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(apiKey);
    const requestDetails: RequestDetails = {
      url: url.replace(/key=[^&]+/, 'key=[REDACTED]'),
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    try {
      const response = await this.withTimeout(
        fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
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
          const error = new Error('Invalid API key');
          (error as Error & { technicalDetails?: string }).technicalDetails = technicalDetails;
          throw error;
        }
        const error = new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
        (error as Error & { technicalDetails?: string }).technicalDetails = technicalDetails;
        throw error;
      }

      const data: GoogleModelsResponse = await response.json();
      responseDetails.body = data;
      
      if (!data.models || !Array.isArray(data.models)) {
        return [];
      }

      // Filter models that support generateContent method
      const availableModels = data.models
        .filter((model) => {
          const methods = model.supportedGenerationMethods || [];
          return methods.includes('generateContent');
        })
        .map((model) => {
          // Single source of truth: Normalize model names only here when fetching from Google API
          // Extract model name from full path (e.g., "models/gemini-1.5-flash" -> "gemini-1.5-flash")
          // Google's API consistently returns model paths with "models/" prefix, so we strip it
          const name = model.name || '';
          return name.replace(/^models\//, '');
        })
        .filter((name) => name.length > 0)
        .sort();

      return availableModels;
    } catch (error) {
      // If error already has technical details, preserve them
      if (error instanceof Error && (error as Error & { technicalDetails?: string }).technicalDetails) {
        throw error;
      }
      
      // Otherwise, add request details
      const requestResponseLog: RequestResponseLog = {
        request: requestDetails,
      };
      const technicalDetails = this.formatRequestResponseLog(requestResponseLog);
      const enhancedError = new Error(this.handleError(error));
      (enhancedError as Error & { technicalDetails?: string }).technicalDetails = technicalDetails;
      throw enhancedError;
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

    // Get model name - model names should already be normalized from fetchAvailableModels()
    // Only strip "models/" prefix as a safety check in case a model path somehow gets through
    let modelName = (options?.model as string) || 'gemini-1.5-flash';
    if (modelName.startsWith('models/')) {
      modelName = modelName.replace(/^models\//, '');
    }
    
    const temperature = (options?.temperature as number) || 0.7;
    const maxTokens = (options?.maxTokens as number) || 1000;

    const genAI = new GoogleGenerativeAI(apiKey);

    // Capture request details
    const requestDetails: RequestDetails = {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
      method: 'POST',
      model: modelName,
      temperature,
      maxTokens,
      prompt: prompt.substring(0, 500), // Preview of prompt
      body: {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      },
    };

    try {
      const model = genAI.getGenerativeModel({ model: modelName });

      const generationConfig = {
        temperature,
        maxOutputTokens: maxTokens,
      };

      const requestPayload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
      };

      const result = await this.withTimeout(
        model.generateContent(requestPayload)
      );

      const response = result.response;
      const text = response.text();

      // Capture response details
      const responseDetails: ResponseDetails = {
        status: 200,
        data: {
          candidates: (response as unknown as { candidates?: unknown[] }).candidates,
          promptFeedback: (response as unknown as { promptFeedback?: unknown }).promptFeedback,
        },
      };

      if (!text) {
        // Capture more details about the empty response
        let errorMessage = 'No response from Google Gemini';
        let technicalDetails = `Model: ${modelName}, Response received but text is empty`;
        
        try {
          // Try to extract additional details from the response
          const candidates = (response as unknown as { candidates?: Array<{ finishReason?: string; safetyRatings?: Array<{ blocked?: boolean; category?: string }> }> }).candidates;
          
          if (candidates && candidates.length > 0) {
            const firstCandidate = candidates[0];
            const finishReason = firstCandidate?.finishReason;
            const safetyRatings = firstCandidate?.safetyRatings;
            
            if (finishReason) {
              technicalDetails += `, Finish reason: ${finishReason}`;
              
              if (finishReason === 'SAFETY') {
                errorMessage = 'Response was blocked due to content safety filters. Google Gemini has safety settings that prevent certain types of content.';
                technicalDetails += ', Blocked by safety filters';
              } else if (finishReason === 'MAX_TOKENS') {
                errorMessage = 'Response was truncated due to token limit.';
                technicalDetails += ', Token limit reached';
              } else if (finishReason === 'RECITATION') {
                errorMessage = 'Response was blocked due to potential recitation of copyrighted content.';
                technicalDetails += ', Blocked due to recitation detection';
              }
            }
            
            if (safetyRatings && Array.isArray(safetyRatings) && safetyRatings.length > 0) {
              const blockedCategories = safetyRatings
                .filter((rating) => rating.blocked)
                .map((rating) => rating.category)
                .filter((cat): cat is string => Boolean(cat));
              
              if (blockedCategories.length > 0) {
                technicalDetails += `, Blocked categories: ${blockedCategories.join(', ')}`;
              }
            }
          }
        } catch (detailError) {
          // If we can't extract details, continue with basic error
          technicalDetails += ', Unable to extract detailed error information';
        }
        
        // Add request/response details
        const requestResponseLog: RequestResponseLog = {
          request: requestDetails,
          response: responseDetails,
        };
        technicalDetails += '\n\n' + this.formatRequestResponseLog(requestResponseLog);
        
        const error = new Error(errorMessage);
        (error as Error & { technicalDetails?: string }).technicalDetails = technicalDetails;
        throw error;
      }

      return text;
    } catch (error) {
      // Capture error response details
      let errorResponseDetails: ResponseDetails | undefined;
      
      try {
        // Try to extract error details from the error object
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

      // Handle Google-specific PROHIBITED_CONTENT error
      if (error instanceof Error) {
        if (error.message.includes('PROHIBITED_CONTENT') || error.message.includes('Text not available')) {
          const errorMessage = 'Response was blocked due to content safety filters. Google Gemini has safety settings that prevent certain types of content. Try rephrasing your prompt or adjusting the content.';
          
          // Add request/response details
          const requestResponseLog: RequestResponseLog = {
            request: requestDetails,
            response: errorResponseDetails,
          };
          const technicalDetails = this.formatRequestResponseLog(requestResponseLog);
          
          const enhancedError = new Error(errorMessage);
          (enhancedError as Error & { technicalDetails?: string }).technicalDetails = technicalDetails;
          throw enhancedError;
        }
        
        // Preserve technical details if they exist, or add request/response log
        const existingTechnicalDetails = (error as Error & { technicalDetails?: string }).technicalDetails;
        if (existingTechnicalDetails) {
          const requestResponseLog: RequestResponseLog = {
            request: requestDetails,
            response: errorResponseDetails,
          };
          const requestResponseDetails = this.formatRequestResponseLog(requestResponseLog);
          const enhancedError = new Error(this.handleError(error));
          (enhancedError as Error & { technicalDetails?: string }).technicalDetails = 
            existingTechnicalDetails + '\n\n' + requestResponseDetails;
          throw enhancedError;
        } else {
          // Add request/response details to new error
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
      
      // Fallback: add request details even if error is not an Error instance
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

