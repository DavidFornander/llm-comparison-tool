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

  return `You are synthesizing responses from expert AI models to provide the best answer to the user's question.

**User's Question:**
"${originalPrompt}"

**Expert Responses:**

${formattedResponses}

**Your Task:**

**CRITICAL: Start your response immediately with the answer. Do NOT include any introductory text at the beginning. Go straight to the synthesized content. You may include explanations or meta-commentary AFTER the main answer, but never before it.**

**If the question asks for a list, ranking, or "top X" items:**
- Extract ALL items from each expert response
- Combine them into ONE unified list
- Remove duplicates (items that are the same or very similar)
- If rankings/orderings differ, create a combined ranking based on:
  - Items mentioned by multiple experts (higher priority)
  - The quality/strength of each expert's reasoning
  - Logical ordering (best to worst, most to least important, etc.)
- Present as a numbered or bulleted list with brief explanations
- Include items even if only one expert mentioned them (but note if multiple experts agree)
- **At the end, add a markdown table showing which items came from which providers and their rankings**
  - Table format: | Item | Provider 1 | Provider 2 | Provider 3 | ... |
  - Include ALL items from the combined list above (even if the table is long)
  - Match each item exactly as it appears in the combined list above
  - For each provider column:
    - If the provider ranked the item, show the ranking number (1, 2, 3, etc.)
    - If the provider mentioned the item but didn't rank it, show "X"
    - If the provider didn't mention the item, show "X"
  - Use the actual provider names as column headers (e.g., "OpenAI", "Anthropic", "Google")
  - This helps users see which providers mentioned each item and how they ranked them

**If the question is NOT asking for a list:**
- Extract the best and most relevant information from each response
- Combine into a coherent answer that directly addresses the user's question
- Remove redundancy while keeping all important details
- If responses agree, present that as the main answer
- If responses differ, include both perspectives clearly

**Formatting:**
- Use markdown (headings, lists, code blocks where appropriate)
- Be concise but complete
- Start with a direct answer to the question
- Trust the expert responses - your role is to synthesize, not analyze

**IMPORTANT:** 
- Do NOT include any introductory text at the START like "As requested" or "I will extract"
- Start immediately with the synthesized answer
- You may include explanations, methodology, or meta-commentary AFTER the main answer if helpful
- The first thing the user reads should be the answer itself, not an explanation of what you're doing

Provide the synthesized answer in clear markdown format.`;
}
