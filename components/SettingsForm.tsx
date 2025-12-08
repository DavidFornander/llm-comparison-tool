'use client';

import { useState, useEffect, useCallback } from 'react';
import { providerRegistry } from '@/lib/provider-registry';
import { getApiKey, setApiKey, removeApiKey, hasApiKey, getDefaultModel, setDefaultModel, isProviderEnabled, setProviderEnabled } from '@/lib/storage';
import type { ProviderId } from '@/types';
import { providerUrls } from '@/lib/provider-urls';

export default function SettingsForm() {
  const providers = providerRegistry.getConfigs();
  const [apiKeys, setApiKeys] = useState<Record<ProviderId, string>>({} as Record<ProviderId, string>);
  const [savedStatus, setSavedStatus] = useState<Record<ProviderId, boolean>>({} as Record<ProviderId, boolean>);
  const [showKeys, setShowKeys] = useState<Record<ProviderId, boolean>>({} as Record<ProviderId, boolean>);
  const [defaultModels, setDefaultModels] = useState<Record<ProviderId, string>>({} as Record<ProviderId, string>);
  const [availableModels, setAvailableModels] = useState<Record<ProviderId, string[]>>({} as Record<ProviderId, string[]>);
  const [loadingModels, setLoadingModels] = useState<Record<ProviderId, boolean>>({} as Record<ProviderId, boolean>);
  const [providerEnabled, setProviderEnabledState] = useState<Record<ProviderId, boolean>>({} as Record<ProviderId, boolean>);
  const [serverSideKeys, setServerSideKeys] = useState<Set<ProviderId>>(new Set());
  const [modelErrors, setModelErrors] = useState<Record<ProviderId, string | null>>({} as Record<ProviderId, string | null>);

  // Fetch server-side key availability
  useEffect(() => {
    const fetchServerKeys = async () => {
      try {
        const res = await fetch('/api/keys');
        if (!res.ok) return;
        const data = await res.json();
        const serverKeys = new Set<ProviderId>();
        Object.entries(data.availableKeys || {}).forEach(([id, available]) => {
          if (available) serverKeys.add(id as ProviderId);
        });
        setServerSideKeys(serverKeys);
      } catch (error) {
        console.error('Failed to fetch server-side keys', error);
      }
    };
    fetchServerKeys();
  }, []);

  // Fetch available models for providers with API keys
  const fetchModelsForProvider = useCallback(async (providerId: ProviderId) => {
    // Allow fetch if client key exists OR server-side key exists
    if (!hasApiKey(providerId) && !serverSideKeys.has(providerId)) {
      return;
    }

    setLoadingModels((prev) => ({ ...prev, [providerId]: true }));
    setModelErrors((prev) => ({ ...prev, [providerId]: null }));

    try {
      const apiKey = getApiKey(providerId);
      const params = new URLSearchParams({ providerId });
      // Only append apiKey if we have a client key; otherwise server key will be used on backend
      if (apiKey) {
        params.append('apiKey', apiKey);
      }
      const response = await fetch(`/api/models?${params.toString()}`);

      if (response.ok) {
        const data = await response.json();
        const models = data.models || [];
        setAvailableModels((prev) => ({ ...prev, [providerId]: models }));
      }
    } catch (error) {
      setModelErrors((prev) => ({
        ...prev,
        [providerId]: error instanceof Error ? error.message : 'Failed to load models',
      }));
      console.error(`Error fetching models for ${providerId}:`, error);
    } finally {
      setLoadingModels((prev) => ({ ...prev, [providerId]: false }));
    }
  }, [serverSideKeys]);

  useEffect(() => {
    // Load existing API keys (masked)
    const loaded: Record<ProviderId, string> = {} as Record<ProviderId, string>;
    const saved: Record<ProviderId, boolean> = {} as Record<ProviderId, boolean>;
    const defaults: Record<ProviderId, string> = {} as Record<ProviderId, string>;
    const enabled: Record<ProviderId, boolean> = {} as Record<ProviderId, boolean>;
    
    providers.forEach((provider) => {
      const clientKey = hasApiKey(provider.id);
      if (clientKey) {
        const key = getApiKey(provider.id);
        if (key) {
          // Show masked version
          loaded[provider.id] = '•'.repeat(20);
          saved[provider.id] = true;
        }
      } else {
        loaded[provider.id] = '';
        saved[provider.id] = false;
      }
      
      // Load default model
      const defaultModel = getDefaultModel(provider.id);
      if (defaultModel) {
        defaults[provider.id] = defaultModel;
      }
      
      // Load enabled state
      enabled[provider.id] = isProviderEnabled(provider.id);
    });
    
    setApiKeys(loaded);
    setSavedStatus(saved);
    setDefaultModels(defaults);
    setProviderEnabledState(enabled);
  }, [providers]);

  // Auto-fetch removed - models must be manually refreshed via "Refresh models" button

  const handleSave = (providerId: ProviderId) => {
    const key = apiKeys[providerId];
    if (!key || key.trim().length === 0) {
      alert('Please enter an API key');
      return;
    }

    // If it's masked, don't update
    if (key.startsWith('•')) {
      return;
    }

    try {
      setApiKey(providerId, key);
      setSavedStatus({ ...savedStatus, [providerId]: true });
      setApiKeys({ ...apiKeys, [providerId]: '•'.repeat(20) });
      setShowKeys({ ...showKeys, [providerId]: false });
    } catch (error) {
      alert(`Failed to save API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRemove = (providerId: ProviderId) => {
    if (confirm('Are you sure you want to remove this API key?')) {
      try {
        removeApiKey(providerId);
        setApiKeys({ ...apiKeys, [providerId]: '' });
        setSavedStatus({ ...savedStatus, [providerId]: false });
        setShowKeys({ ...showKeys, [providerId]: false });
      } catch (error) {
        alert(`Failed to remove API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  const handleChange = (providerId: ProviderId, value: string) => {
    setApiKeys({ ...apiKeys, [providerId]: value });
    setShowKeys({ ...showKeys, [providerId]: true });
  };

  const toggleShowKey = (providerId: ProviderId) => {
    if (savedStatus[providerId] && apiKeys[providerId].startsWith('•')) {
      // Load actual key temporarily
      const actualKey = getApiKey(providerId);
      if (actualKey) {
        setApiKeys({ ...apiKeys, [providerId]: actualKey });
        setShowKeys({ ...showKeys, [providerId]: true });
      }
    } else {
      setShowKeys({ ...showKeys, [providerId]: !showKeys[providerId] });
    }
  };

  const handleDefaultModelChange = (providerId: ProviderId, model: string) => {
    setDefaultModel(providerId, model);
    setDefaultModels((prev) => ({ ...prev, [providerId]: model }));
  };

  const handleProviderEnabledChange = (providerId: ProviderId, enabled: boolean) => {
    setProviderEnabled(providerId, enabled);
    setProviderEnabledState((prev) => ({ ...prev, [providerId]: enabled }));
  };

  const renderProviderCard = (provider: ReturnType<typeof providerRegistry.getConfigs>[number]) => {
    const isSaved = savedStatus[provider.id];
    const isShowing = showKeys[provider.id];
    const currentValue = apiKeys[provider.id] || '';

    return (
      <div
        key={provider.id}
        className="border border-border/60 rounded-xl p-6 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground">
              {provider.displayName}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Provider ID: {provider.id}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Enable/Disable Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm font-medium text-muted-foreground">
                {(providerEnabled[provider.id] ?? true) ? 'Enabled' : 'Disabled'}
              </span>
              <div className="relative inline-block h-6 w-11 cursor-pointer">
                <input
                  type="checkbox"
                  checked={providerEnabled[provider.id] ?? true}
                  onChange={(e) => handleProviderEnabledChange(provider.id, e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`block h-6 w-11 rounded-full transition-colors duration-200 ease-in-out ${
                    (providerEnabled[provider.id] ?? true)
                      ? 'bg-primary'
                      : 'bg-muted'
                  }`}
                />
                <div
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ease-in-out ${
                    (providerEnabled[provider.id] ?? true) ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </div>
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {isSaved && (
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-medium rounded-full">
                  Client key saved
                </span>
              )}
              {serverSideKeys.has(provider.id) && (
                <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 text-xs font-medium rounded-full">
                  Server key (env)
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                API Key
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <input
                type={isShowing ? 'text' : 'password'}
                value={currentValue}
                onChange={(e) => handleChange(provider.id, e.target.value)}
                placeholder={`Enter ${provider.displayName} API key`}
                className="flex-1 min-w-[200px] px-3 sm:px-4 py-2 text-sm sm:text-base border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
              />
              <button
                type="button"
                onClick={() => toggleShowKey(provider.id)}
                className="px-3 sm:px-4 py-2 text-sm sm:text-base border border-border rounded-xl hover:bg-accent text-foreground whitespace-nowrap transition-all duration-200"
              >
                {isShowing ? 'Hide' : 'Show'}
              </button>
              <button
                onClick={() => handleSave(provider.id)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all duration-200 font-medium shadow-sm hover:shadow-md whitespace-nowrap"
              >
                {isSaved ? 'Update' : 'Save'}
              </button>
            </div>

            {isSaved && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleRemove(provider.id)}
                  className="px-4 py-2 bg-destructive text-destructive-foreground rounded-xl hover:bg-destructive/90 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Default Model Selector (always visible) */}
        <div className="mt-4 pt-4 border-t border-border/60 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1">
                Default Model
              </p>
              <p className="text-xs text-muted-foreground">
                Choose the default model for this provider. Fetch models to update the list.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchModelsForProvider(provider.id)}
              disabled={loadingModels[provider.id] || (!isSaved && !serverSideKeys.has(provider.id))}
              className="px-3 py-1.5 text-xs border border-border rounded-xl hover:bg-accent text-foreground disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 font-medium"
            >
              {loadingModels[provider.id] ? 'Loading…' : 'Refresh models'}
            </button>
          </div>

          {loadingModels[provider.id] ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              Loading models...
            </div>
          ) : availableModels[provider.id] && availableModels[provider.id].length > 0 ? (
            <div className="space-y-2">
              <select
                value={defaultModels[provider.id] || ''}
                onChange={(e) => handleDefaultModelChange(provider.id, e.target.value)}
                disabled={!isSaved && !serverSideKeys.has(provider.id)}
                className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                <option value="">Select default model...</option>
                {availableModels[provider.id].map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              <div className="text-xs text-muted-foreground">
                {availableModels[provider.id].length} models found
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground space-y-1">
              <div>
                {(isSaved || serverSideKeys.has(provider.id))
                  ? 'No models available. Check your API key and try refresh.'
                  : 'Save API key or configure server-side key to fetch models.'}
              </div>
              {modelErrors[provider.id] && (
                <div className="text-amber-600 dark:text-amber-400 font-medium">
                  Error: {modelErrors[provider.id]}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Use "Refresh models" after updating keys.
              </div>
            </div>
          )}

          {defaultModels[provider.id] && (
            <p className="text-xs text-muted-foreground">
              Selected default: <span className="font-mono text-foreground">{defaultModels[provider.id]}</span>
            </p>
          )}
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          <p>
            Get your API key from:{' '}
            <a
              href={providerUrls[provider.id].apiKeys}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 hover:underline transition-colors"
            >
              {provider.id === 'openai' && 'OpenAI Platform'}
              {provider.id === 'anthropic' && 'Anthropic Console'}
              {provider.id === 'google' && 'Google AI Studio'}
              {provider.id === 'cohere' && 'Cohere Dashboard'}
              {provider.id === 'grok' && 'xAI Console'}
            </a>
            {' | '}
            <a
              href={providerUrls[provider.id].apiDocs}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 hover:underline transition-colors"
            >
              API Documentation
            </a>
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-8">
        <div>
          <h2 className="text-base font-semibold text-foreground mb-3">Enabled</h2>
          <div className="space-y-6">
            {providers
              .filter((p) => providerEnabled[p.id] ?? true)
              .map((provider) => renderProviderCard(provider))}
            {providers.filter((p) => providerEnabled[p.id] ?? true).length === 0 && (
              <p className="text-sm text-muted-foreground">
                No providers enabled. Toggle a provider to enable it.
              </p>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-base font-semibold text-foreground mb-3">Disabled</h2>
          <div className="space-y-6">
            {providers
              .filter((p) => providerEnabled[p.id] === false)
              .map((provider) => renderProviderCard(provider))}
            {providers.filter((p) => providerEnabled[p.id] === false).length === 0 && (
              <p className="text-sm text-muted-foreground">
                All providers are currently enabled.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

