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

          {/* Assistant Responses */}
          <div className="space-y-4 pl-2 sm:pl-0">
            {group.responses.map((response) => {
              const isModerator = response.providerId === 'moderator';
              const provider = response.providerId && !isModerator
                ? providerRegistry.get(response.providerId)
                : null;

              // Handle moderator messages
              if (isModerator) {
                const isError = !!response.error;
                if (isError) {
                  return (
                    <div key={response.id} className="flex justify-start max-w-[90%] sm:max-w-[80%]">
                      <ErrorDisplay
                        error={response.error!}
                        variant="message"
                        providerName="Moderator"
                        model={response.model}
                        className="w-full relative group animate-slide-up shadow-sm rounded-2xl border-red-100 dark:border-red-900/30"
                      />
                    </div>
                  );
                }

                return (
                  <div key={response.id} className="flex justify-start group/response">
                    <div className={`
                      max-w-[90%] sm:max-w-[80%] rounded-[1.25rem] rounded-tl-sm px-6 py-5 shadow-sm hover:shadow-md
                      bg-card/50 dark:bg-card/40 backdrop-blur-sm border-2 border-primary/50
                      relative animate-slide-up transition-all duration-200 hover:bg-card/80 hover:border-primary/70
                    `}>
                      <div className="flex items-center justify-between mb-3 border-b border-border/30 pb-3">
                        <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-primary">
                          <span>🎯</span>
                          <span>Moderator</span>
                          {response.model && (
                            <span className="text-[10px] font-normal normal-case opacity-75">
                              - {response.model}
                            </span>
                          )}
                        </div>
                        <div className="opacity-0 group-hover/response:opacity-100 transition-all duration-200 scale-95 group-hover/response:scale-100">
                          <MessageActions
                            message={response}
                            onDelete={onDelete ? () => onDelete(response.id) : undefined}
                          />
                        </div>
                      </div>
                      <MarkdownRenderer
                        content={response.content}
                        className="break-words text-foreground/90 leading-relaxed"
                      />
                      <div className="text-[10px] mt-3 text-muted-foreground/60 flex justify-end opacity-0 group-hover/response:opacity-100 transition-opacity">
                        {new Date(response.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              }

              if (!provider) return null;

              // Refined brand colors (using CSS variables/classes where possible or keeping distinct brand identities)
              // Using opacity for a more integrated look
              const providerTextColors: Record<ProviderId, string> = {
                openai: 'text-emerald-600 dark:text-emerald-400',
                anthropic: 'text-amber-600 dark:text-amber-400',
                google: 'text-blue-600 dark:text-blue-400',
                cohere: 'text-rose-600 dark:text-rose-400',
                grok: 'text-zinc-900 dark:text-zinc-100',
              };

              const brandTextColor = (response.providerId && providerTextColors[response.providerId]) || 'text-foreground';
              const isError = !!response.error;

              if (isError) {
                return (
                  <div key={response.id} className="flex justify-start max-w-[90%] sm:max-w-[80%]">
                    <ErrorDisplay
                      error={response.error!}
                      variant="message"
                      providerName={provider.displayName}
                      model={response.model}
                      onRetry={onRegenerate ? () => onRegenerate(response.providerId!, response.id) : undefined}
                      className="w-full relative group animate-slide-up shadow-sm rounded-2xl border-red-100 dark:border-red-900/30"
                    />
                  </div>
                );
              }

              return (
                <div key={response.id} className="flex justify-start group/response">
                  <div className={`
                    max-w-[90%] sm:max-w-[80%] rounded-[1.25rem] rounded-tl-sm px-6 py-5 shadow-sm hover:shadow-md
                    bg-card/50 dark:bg-card/40 backdrop-blur-sm border border-border/60
                    relative animate-slide-up transition-all duration-200 hover:bg-card/80 hover:border-border/80
                  `}>
                    <div className="flex items-center justify-between mb-3 border-b border-border/30 pb-3">
                      <div className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${brandTextColor}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75"></span>
                        {provider.displayName}
                        {response.model && (
                          <span className="text-[10px] font-normal normal-case opacity-75">
                            - {response.model}
                          </span>
                        )}
                      </div>
                      <div className="opacity-0 group-hover/response:opacity-100 transition-all duration-200 scale-95 group-hover/response:scale-100">
                        <MessageActions
                          message={response}
                          onRegenerate={onRegenerate ? () => onRegenerate(response.providerId!, response.id) : undefined}
                          onDelete={onDelete ? () => onDelete(response.id) : undefined}
                        />
                      </div>
                    </div>
                    <MarkdownRenderer
                      content={response.content}
                      className="break-words text-foreground/90 leading-relaxed"
                    />
                    <div className="text-[10px] mt-3 text-muted-foreground/60 flex justify-end opacity-0 group-hover/response:opacity-100 transition-opacity">
                      {new Date(response.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

