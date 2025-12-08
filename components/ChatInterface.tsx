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
import ModeratorDropdown from './ModeratorDropdown';
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
  const [moderatorProvider, setModeratorProvider] = useState<ProviderId | null>(null);
  const [moderatorModel, setModeratorModel] = useState<string | undefined>(undefined);
  const [moderatorModels, setModeratorModels] = useState<Record<ProviderId, string[]>>({});
  const [isLoadingModeratorModels, setIsLoadingModeratorModels] = useState(false);
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

  // Fetch models for all enabled providers with API keys (for moderator dropdown)
  useEffect(() => {
    const fetchAllModels = async () => {
      if (availableApiKeys.size === 0) {
        return;
      }

      setIsLoadingModeratorModels(true);
      const modelsMap: Record<ProviderId, string[]> = {};

      // Filter to only enabled providers with API keys
      const enabledProvidersWithKeys = Array.from(availableApiKeys).filter((providerId) =>
        isProviderEnabled(providerId)
      );

      const fetchPromises = enabledProvidersWithKeys.map(async (providerId) => {
        try {
          // Check cache first
          const cacheKey = `models_${providerId}`;
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const cachedData = JSON.parse(cached);
            const now = Date.now();
            if (now - cachedData.timestamp < 3600000) { // 1 hour cache
              modelsMap[providerId] = cachedData.models;
              return;
            }
          }

          // Get API key
          let apiKey: string | null = null;
          if (!serverSideKeys.has(providerId)) {
            apiKey = getApiKey(providerId);
          }

          // Build query parameters
          const params = new URLSearchParams({ providerId });
          if (apiKey) {
            params.append('apiKey', apiKey);
          }

          const response = await fetch(`/api/models?${params.toString()}`);
          if (response.ok) {
            const data = await response.json();
            const models = data.models || [];
            if (models.length > 0) {
              modelsMap[providerId] = models;
              // Cache the models
              try {
                const cacheData = {
                  models,
                  timestamp: Date.now(),
                };
                localStorage.setItem(cacheKey, JSON.stringify(cacheData));
              } catch (error) {
                console.warn('Failed to cache models:', error);
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching models for ${providerId}:`, error);
        }
      });

      await Promise.all(fetchPromises);
      setModeratorModels(modelsMap);
      setIsLoadingModeratorModels(false);
    };

    fetchAllModels();
  }, [availableApiKeys, serverSideKeys]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle model selection change (memoized to prevent unnecessary re-renders)
  const handleModelChange = useCallback((providerId: ProviderId, model: string) => {
    console.log(`[Model Selection] Setting model for ${providerId}: ${model}`);
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

  // Load default models when providers are selected (only if no model is already selected)
  // This ensures UI selection takes precedence over stored defaults
  useEffect(() => {
    selectedProviders.forEach((providerId) => {
      // Only set default if no model is currently selected for this provider
      if (!selectedModels[providerId]) {
        const defaultModel = getDefaultModel(providerId);
        if (defaultModel) {
          console.log(`[Model Selection] Loading default model for ${providerId}: ${defaultModel}`);
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

      // Always send selectedModels, even if empty, so API can use it
      // Log selected models for debugging
      console.log('[Model Selection] Sending request with selectedModels:', selectedModels);
      
      // Prepare moderator config
      const moderatorConfig = moderatorProvider && moderatorModel ? {
        enabled: true,
        providerId: moderatorProvider,
        model: moderatorModel,
      } : undefined;

      // Collect moderator API key if needed
      if (moderatorConfig && !serverSideKeys.has(moderatorProvider)) {
        const moderatorKey = getApiKey(moderatorProvider);
        if (moderatorKey) {
          apiKeys[moderatorProvider] = moderatorKey;
        }
      }
      
      // Always send selectedModels, even if empty, so API can use it
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: userMessage,
          providerIds: selectedProviders,
          apiKeys,
          selectedModels: selectedModels,
          moderator: moderatorConfig,
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
        model: resp.model,
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
    <div className="flex flex-col h-screen bg-background text-foreground transition-colors overflow-hidden">
      {/* Header */}
      <header className="glass sticky top-0 z-10 border-b border-border/40 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-2 max-w-7xl mx-auto w-full">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            LLM Comparison Tool
          </h1>
          <div className="flex-1 flex justify-center px-4">
            <ModeratorDropdown
              moderatorProvider={moderatorProvider}
              moderatorModel={moderatorModel}
              availableProviders={Array.from(availableApiKeys)}
              providerModels={moderatorModels}
              isLoadingModels={isLoadingModeratorModels}
              serverSideKeys={serverSideKeys}
              onSelectionChange={(providerId, model) => {
                setModeratorProvider(providerId);
                setModeratorModel(model);
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <>
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 border border-border/50">
                  <button
                    onClick={() => setViewMode('chat')}
                    className={`
                      px-3 py-1.5 text-xs sm:text-sm rounded-md transition-all duration-200 font-medium
                      ${viewMode === 'chat'
                        ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                      }
                    `}
                  >
                    Chat
                  </button>
                  <button
                    onClick={() => setViewMode('comparison')}
                    className={`
                      px-3 py-1.5 text-xs sm:text-sm rounded-md transition-all duration-200 font-medium
                      ${viewMode === 'comparison'
                        ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                      }
                    `}
                  >
                    Compare
                  </button>
                </div>
                <button
                  onClick={() => setShowExportDialog(true)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
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
                  className="px-3 sm:px-4 py-2 text-sm sm:text-base text-destructive hover:text-destructive-foreground hover:bg-destructive/90 rounded-lg transition-colors font-medium"
                >
                  Clear
                </button>
              </>
            )}
            <div className="h-6 w-px bg-border/50 mx-1" />
            <ThemeToggle />
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Provider Selector */}
      <div className="bg-background/50 backdrop-blur-sm border-b border-border/40 px-4 sm:px-6 py-6">
        <div className="max-w-7xl mx-auto w-full">
          <ProviderSelector
            selectedProviders={selectedProviders}
            onSelectionChange={setSelectedProviders}
            availableApiKeys={availableApiKeys}
            serverSideKeys={serverSideKeys}
            selectedModels={selectedModels}
            onModelChange={handleModelChange}
          />
        </div>
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
        <div className="max-w-7xl mx-auto w-full h-full">
          {messages.length === 0 ? (
            <EmptyState
              type="welcome"
              selectedProviders={selectedProviders}
            />
          ) : viewMode === 'comparison' ? (
            <ComparisonView
              messages={messages}
              selectedProviders={selectedProviders}
              isLoading={isLoading}
              onRegenerate={handleRegenerate}
              onDelete={handleDeleteMessage}
              moderatorProvider={moderatorProvider}
              moderatorModel={moderatorModel}
            />
          ) : (
            <>
              <MessageList
                messages={
                  moderatorProvider && moderatorModel
                    ? messages.filter(m => m.role === 'user' || m.providerId === 'moderator')
                    : messages
                }
                onRegenerate={handleRegenerate}
                onDelete={handleDeleteMessage}
              />
              <div ref={messagesEndRef} className="h-4" />
            </>
          )}
        </div>

        {isLoading && (
          <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 py-4 bg-background/80 backdrop-blur-md border-t border-border/40 z-20">
            <div className="max-w-7xl mx-auto w-full">
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                <span className="text-sm font-medium">
                  Waiting for responses from {selectedProviders.length} provider(s)...
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedProviders.map((providerId) => {
                  const provider = providerRegistry.get(providerId);
                  return (
                    <div key={providerId} className="flex items-center gap-2 px-3 py-1.5 bg-accent/50 rounded-full border border-border/50 text-xs font-medium">
                      <div className="animate-pulse-slow w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_currentColor] text-primary"></div>
                      <span className="text-foreground">{provider?.displayName}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-background/80 backdrop-blur-lg border-t border-border/40 px-4 sm:px-6 py-6 shadow-2xl shadow-black/5">
        <div className="max-w-7xl mx-auto w-full">
          {selectedProviders.length === 0 ? (
            <div className="text-center py-2">
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Select at least one provider above to start chatting
              </p>
            </div>
          ) : (
            <MessageInput onSend={handleSend} disabled={isLoading || selectedProviders.length === 0} />
          )}
        </div>
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

