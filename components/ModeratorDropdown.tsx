'use client';

import { useState, useEffect, useRef } from 'react';
import { providerRegistry } from '@/lib/provider-registry';
import { isProviderEnabled } from '@/lib/storage';
import type { ProviderId } from '@/types';

interface ModeratorDropdownProps {
  moderatorProvider: ProviderId | null;
  moderatorModel: string | undefined;
  availableProviders: ProviderId[];
  providerModels: Record<ProviderId, string[]>;
  isLoadingModels: boolean;
  onSelectionChange: (providerId: ProviderId | null, model: string | undefined) => void;
  serverSideKeys: Set<ProviderId>;
}

export default function ModeratorDropdown({
  moderatorProvider,
  moderatorModel,
  availableProviders,
  providerModels,
  isLoadingModels,
  onSelectionChange,
  serverSideKeys,
}: ModeratorDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedProviders, setExpandedProviders] = useState<Set<ProviderId>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleProvider = (providerId: ProviderId) => {
    setExpandedProviders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(providerId)) {
        newSet.delete(providerId);
      } else {
        newSet.add(providerId);
      }
      return newSet;
    });
  };

  const handleSelect = (providerId: ProviderId | null, model: string | undefined) => {
    onSelectionChange(providerId, model);
    setIsOpen(false);
  };

  const getDisplayText = () => {
    if (!moderatorProvider || !moderatorModel) {
      return 'Disabled';
    }
    const provider = providerRegistry.get(moderatorProvider);
    return `${provider?.displayName || moderatorProvider} - ${moderatorModel}`;
  };

  // Filter to show all enabled providers (even without API keys)
  const providers = providerRegistry.getConfigs().filter((p) => 
    isProviderEnabled(p.id)
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-all duration-200 font-medium
          border border-border/50 bg-background/50 backdrop-blur-sm
          hover:bg-background hover:border-border
          ${moderatorProvider && moderatorModel ? 'text-primary' : 'text-muted-foreground'}
          flex items-center gap-2
        `}
        disabled={isLoadingModels}
      >
        <span>🎯</span>
        <span className="hidden sm:inline">Moderator:</span>
        <span className="font-normal">{getDisplayText()}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 max-h-96 overflow-y-auto bg-card border border-border rounded-lg shadow-lg z-50 backdrop-blur-sm">
          <div className="p-2">
            {/* Disabled option */}
            <button
              onClick={() => handleSelect(null, undefined)}
              className={`
                w-full text-left px-3 py-2 rounded-md text-sm transition-colors
                ${!moderatorProvider ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent'}
              `}
            >
              ☐ Disabled
            </button>

            <div className="border-t border-border/50 my-2" />

            {/* Loading state */}
            {isLoadingModels && (
              <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                Loading models...
              </div>
            )}

            {/* Provider categories */}
            {providers.map((provider) => {
              const providerInstance = providerRegistry.get(provider.id);
              const requiresKey = providerInstance?.requiresApiKey ?? true;
              const models = providerModels[provider.id] || [];
              const isExpanded = expandedProviders.has(provider.id);
              const isSelected = moderatorProvider === provider.id && moderatorModel;
              const hasApiKey = availableProviders.includes(provider.id) || serverSideKeys.has(provider.id) || !requiresKey;
              const hasModels = models.length > 0;
              // Allow expansion if provider doesn't require key (models will be fetched), or if we have a key and models are available/loading
              const canExpand = hasApiKey && (!requiresKey || hasModels || isLoadingModels);

              return (
                <div key={provider.id}>
                  <button
                    onClick={() => canExpand && toggleProvider(provider.id)}
                    className={`
                      w-full text-left px-3 py-2 rounded-md text-sm font-semibold transition-colors flex items-center justify-between
                      ${canExpand ? 'hover:bg-accent cursor-pointer' : 'opacity-60 cursor-not-allowed'}
                    `}
                    disabled={!canExpand}
                  >
                    <div className="flex items-center gap-2">
                      <span>{provider.displayName}</span>
                      {!hasApiKey && requiresKey && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-500/20 text-red-600 dark:text-red-400 rounded">
                          Missing Key
                        </span>
                      )}
                    </div>
                    {canExpand && (
                      <span className="text-muted-foreground">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    )}
                  </button>

                  {isExpanded && canExpand && (
                    <div className="pl-4 pb-1">
                      {models.length === 0 ? (
                        <div className="px-3 py-1 text-xs text-muted-foreground">
                          {isLoadingModels ? 'Loading models...' : 'No models available'}
                        </div>
                      ) : (
                        models.map((model) => {
                          const isModelSelected = isSelected && moderatorModel === model;
                          return (
                            <button
                              key={model}
                              onClick={() => handleSelect(provider.id, model)}
                              className={`
                                w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors
                                flex items-center gap-2
                                ${isModelSelected
                                  ? 'bg-primary/10 text-primary font-medium'
                                  : 'hover:bg-accent text-foreground'
                                }
                              `}
                            >
                              <span className="text-muted-foreground">•</span>
                              <span>{model}</span>
                              {isModelSelected && (
                                <svg
                                  className="w-4 h-4 ml-auto text-primary"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

