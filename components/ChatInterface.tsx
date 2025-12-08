'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { providerRegistry } from '@/lib/provider-registry';
import { getApiKey, hasApiKey, getDefaultModel, isProviderEnabled } from '@/lib/storage';
import type { Message, ProviderId, ChatResponse } from '@/types';
import ProviderSelector from './ProviderSelector';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ComparisonView from './ComparisonView';
import EmptyState from './EmptyState';
import ThemeToggle from './ThemeToggle';
import ExportDialog from './ExportDialog';
import SettingsModal from './SettingsModal';
import { initTheme } from '@/lib/utils/theme';
import ErrorDisplay from './ErrorDisplay';
import { categorizeError } from '@/lib/utils/error-formatter';

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<ProviderId[]>([]);
  const [selectedModels, setSelectedModels] = useState<Record<ProviderId, string>>(
    () => ({} as Record<ProviderId, string>)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableApiKeys, setAvailableApiKeys] = useState<Set<ProviderId>>(new Set());
  const [serverSideKeys, setServerSideKeys] = useState<Set<ProviderId>>(new Set());
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'chat' | 'comparison'>('chat');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize theme
  useEffect(() => {
    initTheme();
  }, []);

  // Check for server-side API keys and get CSRF token on mount
  useEffect(() => {
    const initializeSecurity = async () => {
      try {
        // Get CSRF token
        const csrfResponse = await fetch('/api/csrf-token');
        if (csrfResponse.ok) {
          const csrfData = await csrfResponse.json();
          setCsrfToken(csrfData.token);
        }

        // Check server-side API keys
        const keysResponse = await fetch('/api/keys');
        if (keysResponse.ok) {
          const keysData = await keysResponse.json();
          const serverKeys = new Set<ProviderId>();
          Object.entries(keysData.availableKeys).forEach(([providerId, available]) => {
            if (available) {
              serverKeys.add(providerId as ProviderId);
            }
          });
          setServerSideKeys(serverKeys);
        }
      } catch (error) {
        console.error('Failed to initialize security:', error);
      }
    };
    initializeSecurity();
  }, []);

  // Check for available API keys (client-side) on mount and when messages change
  useEffect(() => {
    const providers = providerRegistry.getConfigs();
    const available = new Set<ProviderId>();

    // Add server-side keys
    serverSideKeys.forEach((id) => available.add(id));

    // Add client-side keys
    providers.forEach((provider) => {
      if (hasApiKey(provider.id)) {
        available.add(provider.id);
      }
    });

    setAvailableApiKeys(available);
  }, [messages, serverSideKeys]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle model selection change (memoized to prevent unnecessary re-renders)
  const handleModelChange = useCallback((providerId: ProviderId, model: string) => {
    setSelectedModels((prev) => ({
      ...prev,
      [providerId]: model,
    }));
  }, []);

  // Clean up selected models when providers are deselected
  useEffect(() => {
    setSelectedModels((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((id) => {
        if (!selectedProviders.includes(id as ProviderId)) {
          delete updated[id as ProviderId];
        }
      });
      return updated;
    });
  }, [selectedProviders]);

  // Load default models when providers are selected
  useEffect(() => {
    selectedProviders.forEach((providerId) => {
      if (!selectedModels[providerId]) {
        const defaultModel = getDefaultModel(providerId);
        if (defaultModel) {
          setSelectedModels((prev) => ({
            ...prev,
            [providerId]: defaultModel,
          }));
        }
      }
    });
  }, [selectedProviders, selectedModels]);

  const handleSend = async (userMessage: string) => {
    if (selectedProviders.length === 0) {
      setError('Please select at least one provider');
      return;
    }

    // Validate all selected providers have API keys (server-side or client-side)
    const missingKeys: ProviderId[] = [];
    selectedProviders.forEach((id) => {
      if (!serverSideKeys.has(id) && !hasApiKey(id)) {
        missingKeys.push(id);
      }
    });

    if (missingKeys.length > 0) {
      setError(`Missing API keys for: ${missingKeys.join(', ')}. Please configure them in settings.`);
      return;
    }

    setError(null);
    setIsLoading(true);

    // Add user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);

    try {
      // Collect API keys (only client-side keys, server-side keys are handled server-side)
      const apiKeys: Record<ProviderId, string> = {} as Record<ProviderId, string>;
      selectedProviders.forEach((id) => {
        // Only include client-side keys (server-side keys are handled automatically)
        if (!serverSideKeys.has(id)) {
          const key = getApiKey(id);
          if (key) {
            apiKeys[id] = key;
          }
        }
      });

      // Call API with CSRF token
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: userMessage,
          providerIds: selectedProviders,
          apiKeys,
          selectedModels: Object.keys(selectedModels).length > 0 ? selectedModels : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get responses');
      }

      const data: { responses: ChatResponse[] } = await response.json();

      // Add assistant messages
      const assistantMessages: Message[] = data.responses.map((resp) => ({
        id: `${resp.providerId}-${Date.now()}-${Math.random()}`,
        role: 'assistant' as const,
        content: resp.error || resp.content,
        providerId: resp.providerId,
        timestamp: new Date(),
        error: resp.error,
        errorType: resp.error ? categorizeError(resp.error) : undefined,
      }));

      setMessages((prev) => [...prev, ...assistantMessages]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessages = () => {
    if (confirm('Are you sure you want to clear all messages?')) {
      setMessages([]);
      setError(null);
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
  };

  const handleRegenerate = async (providerId: ProviderId, messageId: string) => {
    // Find the user message that this response belongs to
    const responseIndex = messages.findIndex((m) => m.id === messageId);
    if (responseIndex === -1) return;

    // Find the user message before this response
    let userMessageIndex = responseIndex - 1;
    while (userMessageIndex >= 0 && messages[userMessageIndex].role !== 'user') {
      userMessageIndex--;
    }

    if (userMessageIndex === -1) return;

    const userMessage = messages[userMessageIndex];

    // Remove the old response
    setMessages((prev) => prev.filter((m) => m.id !== messageId));

    // Regenerate
    setIsLoading(true);
    try {
      const apiKeys: Record<ProviderId, string> = {} as Record<ProviderId, string>;
      if (!serverSideKeys.has(providerId)) {
        const key = getApiKey(providerId);
        if (key) {
          apiKeys[providerId] = key;
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: userMessage.content,
          providerIds: [providerId],
          apiKeys,
        }),
      });

      if (response.ok) {
        const data: { responses: ChatResponse[] } = await response.json();
        const newResponse = data.responses[0];
        if (newResponse) {
          const newMessage: Message = {
            id: `${providerId}-${Date.now()}-${Math.random()}`,
            role: 'assistant',
            content: newResponse.content,
            providerId: providerId,
            timestamp: new Date(),
            error: newResponse.error,
            errorType: newResponse.error ? categorizeError(newResponse.error) : undefined,
          };
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages.splice(responseIndex, 0, newMessage);
            return newMessages;
          });
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to regenerate' }));
        setError(errorData.error || 'Failed to regenerate');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            LLM Comparison Tool
          </h1>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <>
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('chat')}
                    className={`
                      px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors
                      ${viewMode === 'chat'
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                      }
                    `}
                  >
                    Chat
                  </button>
                  <button
                    onClick={() => setViewMode('comparison')}
                    className={`
                      px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors
                      ${viewMode === 'comparison'
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                      }
                    `}
                  >
                    Compare
                  </button>
                </div>
                <button
                  onClick={() => setShowExportDialog(true)}
                  className="px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Export conversation"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </button>
                <button
                  onClick={clearMessages}
                  className="px-3 sm:px-4 py-2 text-sm sm:text-base text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  Clear
                </button>
              </>
            )}
            <ThemeToggle />
            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* Provider Selector */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 shadow-sm">
        <ProviderSelector
          selectedProviders={selectedProviders}
          onSelectionChange={setSelectedProviders}
          availableApiKeys={availableApiKeys}
          serverSideKeys={serverSideKeys}
          selectedModels={selectedModels}
          onModelChange={handleModelChange}
        />
      </div>

      {/* Error Display */}
      {error && (
        <ErrorDisplay
          error={error}
          onDismiss={() => setError(null)}
          variant="banner"
        />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto relative scroll-smooth scrollbar-thin">
        {messages.length === 0 ? (
          <EmptyState
            type={selectedProviders.length === 0 ? 'no-providers' : 'welcome'}
            selectedProviders={selectedProviders}
          />
        ) : viewMode === 'comparison' ? (
          <ComparisonView
            messages={messages}
            selectedProviders={selectedProviders}
            isLoading={isLoading}
            onRegenerate={handleRegenerate}
            onDelete={handleDeleteMessage}
          />
        ) : (
          <>
            <MessageList
              messages={messages}
              onRegenerate={handleRegenerate}
              onDelete={handleDeleteMessage}
            />
            <div ref={messagesEndRef} />
          </>
        )}

        {isLoading && (
          <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 py-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
              <span className="text-xs sm:text-sm">
                Waiting for responses from {selectedProviders.length} provider(s)...
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {selectedProviders.map((providerId) => {
                const provider = providerRegistry.get(providerId);
                return (
                  <div key={providerId} className="flex items-center gap-2 text-xs">
                    <div className="animate-pulse-slow w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-500 dark:text-gray-400">{provider?.displayName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 shadow-lg">
        {selectedProviders.length === 0 ? (
          <div className="text-center py-2">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Please select at least one provider to start chatting
            </p>
          </div>
        ) : (
          <MessageInput onSend={handleSend} disabled={isLoading || selectedProviders.length === 0} />
        )}
      </div>

      {/* Export Dialog */}
      <ExportDialog
        messages={messages}
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => {
          setShowSettingsModal(false);
          // Clean up disabled providers when settings modal closes
          const enabledProviders = selectedProviders.filter((id) => isProviderEnabled(id));
          if (enabledProviders.length !== selectedProviders.length) {
            setSelectedProviders(enabledProviders);
            setSelectedModels((prev) => {
              const updated = { ...prev };
              selectedProviders.forEach((id) => {
                if (!isProviderEnabled(id)) {
                  delete updated[id];
                }
              });
              return updated;
            });
          }
        }}
      />
    </div>
  );
}

