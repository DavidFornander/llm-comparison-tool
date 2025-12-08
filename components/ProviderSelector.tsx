'use client';

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
  const providers = providerRegistry.getConfigs();

  const toggleProvider = (providerId: ProviderId) => {
    if (selectedProviders.includes(providerId)) {
      onSelectionChange(selectedProviders.filter((id) => id !== providerId));
    } else {
      onSelectionChange([...selectedProviders, providerId]);
    }
  };

  const selectAll = () => {
    const available = providers
      .filter(p => availableApiKeys.has(p.id) && isProviderEnabled(p.id))
      .map(p => p.id);
    onSelectionChange(available);
  };

  const deselectAll = () => {
    onSelectionChange([]);
  };

  // Filter providers to only show enabled ones
  const enabledProviders = providers.filter(p => isProviderEnabled(p.id));
  const availableCount = enabledProviders.filter(p => availableApiKeys.has(p.id)).length;
  const allSelected = selectedProviders.length === availableCount && availableCount > 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
          Select Providers to Compare
        </label>
        {availableCount > 0 && (
          <div className="flex gap-2">
            {!allSelected ? (
              <button
                onClick={selectAll}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Select All
              </button>
            ) : (
              <button
                onClick={deselectAll}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Deselect All
              </button>
            )}
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {enabledProviders.map((provider) => {
          const hasApiKey = availableApiKeys.has(provider.id);
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
      
      {enabledProviders.length === 0 && (
        <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
          No providers are enabled. Please enable at least one provider in Settings.
        </p>
      )}
      
      {selectedProviders.length === 0 && (
        <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
          Please select at least one provider to start comparing
        </p>
      )}
    </div>
  );
}

