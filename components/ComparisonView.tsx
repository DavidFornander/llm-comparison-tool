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
  moderatorProvider?: ProviderId | null;
  moderatorModel?: string | undefined;
}

export default function ComparisonView({
  messages,
  selectedProviders,
  isLoading,
  onRegenerate,
  onDelete,
  moderatorProvider,
  moderatorModel,
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
              <div className="flex justify-end group/message">
                <div className="max-w-[85%] sm:max-w-[75%] bg-primary text-primary-foreground rounded-[1.25rem] rounded-tr-sm px-5 py-3.5 shadow-md shadow-primary/10 transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 relative">
                  <MarkdownRenderer
                    content={group.userMessage.content}
                    className="text-primary-foreground break-words prose-invert leading-relaxed"
                  />
                  <div className="text-[10px] text-primary-foreground/70 mt-1.5 flex justify-end opacity-70 group-hover/message:opacity-100 transition-opacity">
                    {new Date(group.userMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="absolute -top-8 right-0 opacity-0 group-hover/message:opacity-100 transition-all duration-200 scale-95 group-hover/message:scale-100">
                    <MessageActions message={group.userMessage} onDelete={onDelete ? () => onDelete(group.userMessage.id) : undefined} />
                  </div>
                </div>
              </div>

              {/* Provider Responses Grid */}
              {isLoading && turnIndex === groupedMessages.length - 1 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedProviders.map((providerId) => {
                    const provider = providerRegistry.get(providerId);
                    // Brand colors for provider names
                    const providerTextColors: Record<ProviderId, string> = {
                      openai: 'text-emerald-600 dark:text-emerald-400',
                      anthropic: 'text-amber-600 dark:text-amber-400',
                      google: 'text-blue-600 dark:text-blue-400',
                      cohere: 'text-rose-600 dark:text-rose-400',
                      grok: 'text-zinc-900 dark:text-zinc-100',
                    };
                    const brandTextColor = providerTextColors[providerId] || 'text-foreground';
                    
                    return (
                      <div
                        key={providerId}
                        className="rounded-[1.25rem] rounded-tl-sm px-6 py-5 shadow-sm bg-card/50 dark:bg-card/40 backdrop-blur-sm border border-border/60 animate-slide-up"
                      >
                        <div className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 mb-3 ${brandTextColor}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75"></span>
                          {provider?.displayName}
                        </div>
                        <LoadingSkeleton lines={4} />
                      </div>
                    );
                  })}
                  {/* Moderator loading card */}
                  {moderatorProvider && moderatorModel && (
                    <div className="flex justify-start group/response">
                      <div className="w-full rounded-[1.25rem] rounded-tl-sm px-6 py-5 shadow-sm bg-card/50 dark:bg-card/40 backdrop-blur-sm border-2 border-primary/50 animate-slide-up">
                        <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 mb-3 text-primary">
                          <span>🎯</span>
                          <span>Moderator</span>
                        </div>
                        <LoadingSkeleton lines={4} />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedProviders.map((providerId) => {
                    const response = group.responses.find(r => r.providerId === providerId);
                    const provider = providerRegistry.get(providerId);
                    const isError = response?.error ? true : false;
                    
                    // Brand colors for provider names
                    const providerTextColors: Record<ProviderId, string> = {
                      openai: 'text-emerald-600 dark:text-emerald-400',
                      anthropic: 'text-amber-600 dark:text-amber-400',
                      google: 'text-blue-600 dark:text-blue-400',
                      cohere: 'text-rose-600 dark:text-rose-400',
                      grok: 'text-zinc-900 dark:text-zinc-100',
                    };
                    const brandTextColor = (providerId && providerTextColors[providerId]) || 'text-foreground';
                    
                    return (
                      <div
                        key={providerId}
                        className="flex justify-start group/response"
                      >
                        <div className={`
                          w-full rounded-[1.25rem] rounded-tl-sm px-6 py-5 shadow-sm hover:shadow-md
                          bg-card/50 dark:bg-card/40 backdrop-blur-sm border border-border/60
                          relative animate-slide-up transition-all duration-200 hover:bg-card/80 hover:border-border/80
                        `}>
                          {isError && response ? (
                            <div className="w-full">
                              <ErrorDisplay
                                error={response.error!}
                                variant="message"
                                providerName={provider?.displayName}
                                model={response.model}
                                onRetry={onRegenerate ? () => onRegenerate(providerId, response.id) : undefined}
                                className="w-full relative group animate-slide-up shadow-sm rounded-2xl border-red-100 dark:border-red-900/30"
                              />
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between mb-3 border-b border-border/30 pb-3">
                                <div className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${brandTextColor}`}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75"></span>
                                  {provider?.displayName}
                                  {response?.model && (
                                    <span className="text-[10px] font-normal normal-case opacity-75">
                                      - {response.model}
                                    </span>
                                  )}
                                </div>
                                {response && (
                                  <div className="opacity-0 group-hover/response:opacity-100 transition-all duration-200 scale-95 group-hover/response:scale-100">
                                    <MessageActions
                                      message={response}
                                      onRegenerate={onRegenerate ? () => onRegenerate(providerId, response.id) : undefined}
                                      onDelete={onDelete ? () => onDelete(response.id) : undefined}
                                    />
                                  </div>
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
                                    className="break-words text-foreground/90 leading-relaxed"
                                  />
                                ) : (
                                  <div className="text-muted-foreground/60 text-sm italic">
                                    No response yet...
                                  </div>
                                )}
                              </div>
                              
                              {response && (
                                <div className="text-[10px] mt-3 text-muted-foreground/60 flex justify-end opacity-0 group-hover/response:opacity-100 transition-opacity">
                                  {new Date(response.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {/* Moderator card */}
                  {moderatorProvider && moderatorModel && (() => {
                    const moderatorResponse = group.responses.find(r => r.providerId === 'moderator');
                    const moderatorProviderInfo = providerRegistry.get(moderatorProvider);
                    const isError = moderatorResponse?.error ? true : false;
                    
                    return (
                      <div
                        key="moderator"
                        className="flex justify-start group/response"
                      >
                        <div className={`
                          w-full rounded-[1.25rem] rounded-tl-sm px-6 py-5 shadow-sm hover:shadow-md
                          bg-card/50 dark:bg-card/40 backdrop-blur-sm border-2 border-primary/50
                          relative animate-slide-up transition-all duration-200 hover:bg-card/80 hover:border-primary/70
                        `}>
                          {isError && moderatorResponse ? (
                            <div className="w-full">
                              <ErrorDisplay
                                error={moderatorResponse.error!}
                                variant="message"
                                providerName={`Moderator (${moderatorProviderInfo?.displayName || moderatorProvider})`}
                                model={moderatorResponse.model}
                                onRetry={onRegenerate ? () => onRegenerate(moderatorProvider, moderatorResponse.id) : undefined}
                                className="w-full relative group animate-slide-up shadow-sm rounded-2xl border-red-100 dark:border-red-900/30"
                              />
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between mb-3 border-b border-border/30 pb-3">
                                <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-primary">
                                  <span>🎯</span>
                                  <span>Moderator</span>
                                  <span className="text-[10px] font-normal normal-case opacity-75">
                                    ({moderatorProviderInfo?.displayName || moderatorProvider} - {moderatorModel})
                                  </span>
                                </div>
                                {moderatorResponse && (
                                  <div className="opacity-0 group-hover/response:opacity-100 transition-all duration-200 scale-95 group-hover/response:scale-100">
                                    <MessageActions
                                      message={moderatorResponse}
                                      onRegenerate={undefined}
                                      onDelete={onDelete ? () => onDelete(moderatorResponse.id) : undefined}
                                    />
                                  </div>
                                )}
                              </div>
                              
                              <div
                                ref={(el) => {
                                  if (el) scrollRefs.current.set(`${turnId}-moderator`, el);
                                }}
                                onScroll={() => handleScroll(`${turnId}-moderator`)}
                                className="max-h-96 overflow-y-auto scrollbar-hide"
                              >
                                {moderatorResponse ? (
                                  <MarkdownRenderer
                                    content={moderatorResponse.content}
                                    className="break-words text-foreground/90 leading-relaxed"
                                  />
                                ) : (
                                  <div className="text-muted-foreground/60 text-sm italic">
                                    Analyzing responses...
                                  </div>
                                )}
                              </div>
                              
                              {moderatorResponse && (
                                <div className="text-[10px] mt-3 text-muted-foreground/60 flex justify-end opacity-0 group-hover/response:opacity-100 transition-opacity">
                                  {new Date(moderatorResponse.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

