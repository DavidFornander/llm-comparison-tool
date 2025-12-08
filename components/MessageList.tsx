'use client';

import { providerRegistry } from '@/lib/provider-registry';
import type { Message, ProviderId } from '@/types';
import MessageActions from './MessageActions';
import ErrorDisplay from './ErrorDisplay';
import MarkdownRenderer from './MarkdownRenderer';

interface MessageListProps {
  messages: Message[];
  onRegenerate?: (providerId: ProviderId, messageId: string) => void;
  onDelete?: (messageId: string) => void;
}

export default function MessageList({ messages, onRegenerate, onDelete }: MessageListProps) {
  if (messages.length === 0) {
    return null; // EmptyState will be handled by parent
  }

  // Group messages by conversation turn
  const groupedMessages: Array<{
    userMessage: Message;
    responses: Message[];
  }> = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (message.role === 'user') {
      const responses: Message[] = [];
      // Collect all assistant responses until next user message
      for (let j = i + 1; j < messages.length; j++) {
        if (messages[j].role === 'user') break;
        responses.push(messages[j]);
      }
      groupedMessages.push({ userMessage: message, responses });
    }
  }

  return (
    <div className="space-y-6 p-4 animate-fade-in">
      {groupedMessages.map((group) => (
        <div key={group.userMessage.id} className="space-y-3 animate-slide-up">
          {/* User Message */}
          <div className="flex justify-end">
            <div className="max-w-[85%] sm:max-w-[75%] bg-blue-500 dark:bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-md relative group">
              <MarkdownRenderer
                content={group.userMessage.content}
                className="text-white break-words"
              />
              <div className="text-xs text-blue-100 mt-2 opacity-75">
                {new Date(group.userMessage.timestamp).toLocaleTimeString()}
              </div>
              <div className="absolute -top-10 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <MessageActions message={group.userMessage} onDelete={onDelete ? () => onDelete(group.userMessage.id) : undefined} />
              </div>
            </div>
          </div>

          {/* Assistant Responses */}
          <div className="space-y-2">
            {group.responses.map((response) => {
              const provider = response.providerId
                ? providerRegistry.get(response.providerId)
                : null;

              if (!provider) return null;

              const providerColors: Record<ProviderId, { bg: string; border: string; text: string }> = {
                openai: {
                  bg: 'bg-green-50 dark:bg-green-900/20',
                  border: 'border-green-200 dark:border-green-800',
                  text: 'text-green-700 dark:text-green-300',
                },
                anthropic: {
                  bg: 'bg-amber-50 dark:bg-amber-900/20',
                  border: 'border-amber-200 dark:border-amber-800',
                  text: 'text-amber-700 dark:text-amber-300',
                },
                google: {
                  bg: 'bg-blue-50 dark:bg-blue-900/20',
                  border: 'border-blue-200 dark:border-blue-800',
                  text: 'text-blue-700 dark:text-blue-300',
                },
                cohere: {
                  bg: 'bg-red-50 dark:bg-red-900/20',
                  border: 'border-red-200 dark:border-red-800',
                  text: 'text-red-700 dark:text-red-300',
                },
                grok: {
                  bg: 'bg-gray-50 dark:bg-gray-900/20',
                  border: 'border-gray-200 dark:border-gray-800',
                  text: 'text-gray-700 dark:text-gray-300',
                },
              };

              const colors = (response.providerId && providerColors[response.providerId]) || providerColors.grok;
              const isError = !!response.error;

              if (isError) {
                return (
                  <div key={response.id} className="flex justify-start max-w-[85%] sm:max-w-[75%]">
                    <ErrorDisplay
                      error={response.error!}
                      variant="message"
                      providerName={provider.displayName}
                      onRetry={onRegenerate ? () => onRegenerate(response.providerId!, response.id) : undefined}
                      className="w-full relative group animate-slide-up"
                    />
                  </div>
                );
              }

              return (
                <div key={response.id} className="flex justify-start">
                  <div className={`
                    max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tl-sm px-4 py-3 shadow-md
                    border-2 ${colors.bg} ${colors.border}
                    relative group animate-slide-up
                  `}>
                    <div className="flex items-center justify-between mb-2">
                      <div className={`text-xs font-semibold flex items-center gap-2 ${colors.text}`}>
                        {provider.displayName}
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <MessageActions
                          message={response}
                          onRegenerate={onRegenerate ? () => onRegenerate(response.providerId!, response.id) : undefined}
                          onDelete={onDelete ? () => onDelete(response.id) : undefined}
                        />
                      </div>
                    </div>
                    <MarkdownRenderer
                      content={response.content}
                      className="break-words"
                    />
                    <div className={`text-xs mt-2 text-gray-500 dark:text-gray-400`}>
                      {new Date(response.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

