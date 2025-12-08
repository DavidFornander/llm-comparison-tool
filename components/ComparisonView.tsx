'use client';

import { useRef } from 'react';
import { providerRegistry } from '@/lib/provider-registry';
import type { Message, ProviderId } from '@/types';
import MessageActions from './MessageActions';
import LoadingSkeleton from './LoadingSkeleton';
import ErrorDisplay from './ErrorDisplay';
import MarkdownRenderer from './MarkdownRenderer';

interface ComparisonViewProps {
  messages: Message[];
  selectedProviders: ProviderId[];
  isLoading: boolean;
  onRegenerate?: (providerId: ProviderId, messageId: string) => void;
  onDelete?: (messageId: string) => void;
}

export default function ComparisonView({
  messages,
  selectedProviders,
  isLoading,
  onRegenerate,
  onDelete,
}: ComparisonViewProps) {
  const scrollRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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

  // Synchronized scrolling
  const handleScroll = (turnId: string) => {
    const scrolledElement = scrollRefs.current.get(turnId);
    if (!scrolledElement) return;

    const scrollTop = scrolledElement.scrollTop;
    scrollRefs.current.forEach((ref, id) => {
      if (id !== turnId && ref) {
        ref.scrollTop = scrollTop;
      }
    });
  };

  if (groupedMessages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <p>No messages yet. Start a conversation to see comparisons.</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto p-4">
      <div className="space-y-6">
        {groupedMessages.map((group, turnIndex) => {
          const turnId = `turn-${turnIndex}`;
          
          return (
            <div key={turnId} className="space-y-4">
              {/* User Message */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">
                      You
                    </div>
                    <MarkdownRenderer
                      content={group.userMessage.content}
                      className="break-words"
                    />
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                      {new Date(group.userMessage.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <MessageActions message={group.userMessage} onDelete={onDelete ? () => onDelete(group.userMessage.id) : undefined} />
                </div>
              </div>

              {/* Provider Responses Grid */}
              {isLoading && turnIndex === groupedMessages.length - 1 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedProviders.map((providerId) => {
                    const provider = providerRegistry.get(providerId);
                    return (
                      <div
                        key={providerId}
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                      >
                        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                          {provider?.displayName}
                        </div>
                        <LoadingSkeleton lines={4} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedProviders.map((providerId) => {
                    const response = group.responses.find(r => r.providerId === providerId);
                    const provider = providerRegistry.get(providerId);
                    const isError = response?.error ? true : false;
                    
                    return (
                      <div
                        key={providerId}
                        className={`border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow ${
                          isError
                            ? ''
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        {isError && response ? (
                          <div>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <ErrorDisplay
                                  error={response.error!}
                                  variant="inline"
                                  providerName={provider?.displayName}
                                  onRetry={onRegenerate ? () => onRegenerate(providerId, response.id) : undefined}
                                  className="mb-0"
                                />
                              </div>
                              <MessageActions
                                message={response}
                                onDelete={onDelete ? () => onDelete(response.id) : undefined}
                              />
                            </div>
                            <div className="text-xs mt-2 text-gray-500 dark:text-gray-400">
                              {new Date(response.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between mb-2">
                              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {provider?.displayName}
                              </div>
                              {response && (
                                <MessageActions
                                  message={response}
                                  onRegenerate={onRegenerate ? () => onRegenerate(providerId, response.id) : undefined}
                                  onDelete={onDelete ? () => onDelete(response.id) : undefined}
                                />
                              )}
                            </div>
                            
                            <div
                              ref={(el) => {
                                if (el) scrollRefs.current.set(`${turnId}-${providerId}`, el);
                              }}
                              onScroll={() => handleScroll(`${turnId}-${providerId}`)}
                              className="max-h-96 overflow-y-auto scrollbar-hide"
                            >
                              {response ? (
                              <MarkdownRenderer
                                content={response.content}
                                className="break-words text-gray-700 dark:text-gray-300"
                              />
                              ) : (
                                <div className="text-gray-400 dark:text-gray-600 text-sm italic">
                                  No response yet...
                                </div>
                              )}
                            </div>
                            
                            {response && (
                              <div className="text-xs mt-2 text-gray-500 dark:text-gray-400">
                                {new Date(response.timestamp).toLocaleTimeString()}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

