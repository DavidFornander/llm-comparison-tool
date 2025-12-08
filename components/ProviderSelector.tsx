'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { providerRegistry } from '@/lib/provider-registry';
import { isProviderEnabled } from '@/lib/storage';
import type { ProviderId } from '@/types';
import ProviderCard from './ProviderCard';

interface ProviderSelectorProps {
  selectedProviders: ProviderId[];
  onSelectionChange: (providers: ProviderId[]) => void;
  availableApiKeys: Set<ProviderId>;
  serverSideKeys: Set<ProviderId>;
  selectedModels?: Record<ProviderId, string>;
  onModelChange?: (providerId: ProviderId, model: string) => void;
}

export default function ProviderSelector({
  selectedProviders,
  onSelectionChange,
  availableApiKeys,
  serverSideKeys,
  selectedModels,
  onModelChange,
}: ProviderSelectorProps) {
  // Memoize providers to avoid creating new array on every render
  const providers = useMemo(() => providerRegistry.getConfigs(), []);
  // Initialize with all providers to avoid hydration mismatch (server doesn't have localStorage)
  const [enabledProviders, setEnabledProviders] = useState(providers);
  const [mounted, setMounted] = useState(false);
  const prevEnabledIdsRef = useRef<string>('');

  // Filter providers client-side only to avoid hydration mismatch
  // Update when providers are enabled/disabled (only after mount)
  useEffect(() => {
    setMounted(true);
    const enabled = providers.filter(p => isProviderEnabled(p.id));
    const enabledIds = enabled.map(p => p.id).sort().join(',');
    
    // Only update if enabled providers actually changed
    if (enabledIds !== prevEnabledIdsRef.current) {
      prevEnabledIdsRef.current = enabledIds;
      setEnabledProviders(enabled);
    }
  }, [providers]);

  const toggleProvider = (providerId: ProviderId) => {
    if (selectedProviders.includes(providerId)) {
      onSelectionChange(selectedProviders.filter((id) => id !== providerId));
    } else {
      onSelectionChange([...selectedProviders, providerId]);
    }
  };

  const selectAll = () => {
    const available = enabledProviders
      .filter(p => {
        const provider = providerRegistry.get(p.id);
        return availableApiKeys.has(p.id) || (provider && !provider.requiresApiKey);
      })
      .map(p => p.id);
    onSelectionChange(available);
  };

  const deselectAll = () => {
    onSelectionChange([]);
  };

  const availableCount = enabledProviders.filter(p => {
    const provider = providerRegistry.get(p.id);
    return availableApiKeys.has(p.id) || (provider && !provider.requiresApiKey);
  }).length;
  const allSelected = selectedProviders.length === availableCount && availableCount > 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <label className="block text-sm font-semibold text-foreground">
          Select Providers to Compare
        </label>
        {availableCount > 0 && (
          <div className="flex gap-3">
            {!allSelected ? (
              <button
                onClick={selectAll}
                className="text-xs font-medium text-primary hover:text-primary/80 hover:underline transition-colors"
              >
                Select All
              </button>
            ) : (
              <button
                onClick={deselectAll}
                className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline transition-colors"
              >
                Deselect All
              </button>
            )}
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {enabledProviders.map((provider) => {
          const providerInstance = providerRegistry.get(provider.id);
          const hasApiKey = availableApiKeys.has(provider.id) || (providerInstance && !providerInstance.requiresApiKey);
          const isSelected = selectedProviders.includes(provider.id);
          
          return (
            <ProviderCard
              key={provider.id}
              providerId={provider.id}
              isSelected={isSelected}
              isAvailable={hasApiKey}
              onClick={() => toggleProvider(provider.id)}
              selectedModel={selectedModels?.[provider.id]}
              onModelChange={onModelChange}
              serverSideKey={serverSideKeys.has(provider.id)}
            />
          );
        })}
      </div>
      
      {mounted && enabledProviders.length === 0 && (
        <p className="mt-4 text-sm text-amber-500 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          No providers are enabled. Please enable at least one provider in Settings.
        </p>
      )}
      
      {mounted && selectedProviders.length === 0 && enabledProviders.length > 0 && (
        <p className="mt-4 text-sm text-muted-foreground flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Please select at least one provider to start comparing
        </p>
      )}
    </div>
  );
}

