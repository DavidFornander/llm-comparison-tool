import type { ChatResponse } from '@/types';
import { providerRegistry } from '@/lib/provider-registry';

/**
 * Format provider responses for moderator prompt
 * Includes provider names and responses, handles errors gracefully
 */
export function formatResponsesForModerator(responses: ChatResponse[]): string {
  const formatted: string[] = [];

  responses.forEach((response) => {
    const provider = providerRegistry.get(response.providerId as any);
    const providerName = provider?.displayName || response.providerId;

    if (response.error) {
      formatted.push(`**${providerName}:**\nError: ${response.error}\n`);
    } else {
      formatted.push(`**${providerName}:**\n${response.content}\n`);
    }
  });

  return formatted.join('\n');
}

/**
 * Create moderator prompt with instructions
 * Includes original prompt and formatted responses
 */
export function createModeratorPrompt(originalPrompt: string, responses: ChatResponse[]): string {
  const formattedResponses = formatResponsesForModerator(responses);

  return `You are analyzing responses from multiple LLM providers. The user's original request was:

"${originalPrompt}"

Here are the responses from each provider:

${formattedResponses}

Please compare and analyze these responses in relation to the user's original request. Provide your comparison in markdown format, highlighting:
- Areas of consensus
- Key differences
- How well each response addresses the user's request
- Your insights and analysis

Format your response as clear, well-structured markdown.`;
}
