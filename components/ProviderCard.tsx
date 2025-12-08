'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProviderId } from '@/types';
import { providerRegistry } from '@/lib/provider-registry';
import { getApiKey } from '@/lib/storage';

interface ProviderCardProps {
  providerId: ProviderId;
  isSelected: boolean;
  isAvailable: boolean;
  onClick: () => void;
  selectedModel?: string;
  onModelChange?: (providerId: ProviderId, model: string) => void;
  serverSideKey?: boolean;
}

const providerColors: Record<ProviderId, string> = {
  openai: 'border-[#10a37f]/20 bg-[#10a37f]/3 hover:border-[#10a37f]/50 hover:bg-[#10a37f]/5',
  anthropic: 'border-[#d4a574]/20 bg-[#d4a574]/3 hover:border-[#d4a574]/50 hover:bg-[#d4a574]/5',
  google: 'border-[#4285f4]/20 bg-[#4285f4]/3 hover:border-[#4285f4]/50 hover:bg-[#4285f4]/5',
  cohere: 'border-[#ff6b6b]/20 bg-[#ff6b6b]/3 hover:border-[#ff6b6b]/50 hover:bg-[#ff6b6b]/5',
  grok: 'border-foreground/20 bg-foreground/3 hover:border-foreground/50 hover:bg-foreground/5',
};

const providerSelectedColors: Record<ProviderId, string> = {
  openai: 'border-[#10a37f] bg-[#10a37f]/10 ring-1 ring-[#10a37f]/50',
  anthropic: 'border-[#d4a574] bg-[#d4a574]/10 ring-1 ring-[#d4a574]/50',
  google: 'border-[#4285f4] bg-[#4285f4]/10 ring-1 ring-[#4285f4]/50',
  cohere: 'border-[#ff6b6b] bg-[#ff6b6b]/10 ring-1 ring-[#ff6b6b]/50',
  grok: 'border-foreground bg-foreground/10 ring-1 ring-foreground/50',
};

// Cache key for localStorage
const getCacheKey = (providerId: ProviderId) => `llm_comparison_models_${providerId}`;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

interface CachedModels {
  models: string[];
  timestamp: number;
}

export default function ProviderCard({ 
  providerId, 
  isSelected, 
  isAvailable, 
  onClick,
  selectedModel,
  onModelChange,
  serverSideKey = false,
}: ProviderCardProps) {
  const provider = providerRegistry.get(providerId);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [currentSelectedModel, setCurrentSelectedModel] = useState<string>(selectedModel || '');
  const selectedModelRef = useRef(selectedModel);
  
  // Keep ref in sync with prop
  useEffect(() => {
    selectedModelRef.current = selectedModel;
  }, [selectedModel]);

  // Update local state when prop changes (but don't trigger fetch)
  useEffect(() => {
    if (selectedModel && selectedModel !== currentSelectedModel) {
      setCurrentSelectedModel(selectedModel);
    }
  }, [selectedModel, currentSelectedModel]);

  // Fetch models when provider is selected and has API key
  const fetchModels = useCallback(async () => {
    if (!isSelected || !isAvailable) {
      return;
    }

    // Check cache first
    try {
      const cacheKey = getCacheKey(providerId);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const cachedData: CachedModels = JSON.parse(cached);
        const now = Date.now();
        if (now - cachedData.timestamp < CACHE_DURATION) {
          setAvailableModels(cachedData.models);
          // Set default model if none selected (check prop first, then local state)
          const latestSelectedModel = selectedModelRef.current;
          const hasSelectedModel = latestSelectedModel || currentSelectedModel;
          if (!hasSelectedModel && cachedData.models.length > 0) {
            const defaultModel = cachedData.models[0];
            setCurrentSelectedModel(defaultModel);
            onModelChange?.(providerId, defaultModel);
          } else if (latestSelectedModel && latestSelectedModel !== currentSelectedModel) {
            // Sync local state with prop if it changed
            setCurrentSelectedModel(latestSelectedModel);
          }
          return;
        }
      }
    } catch (error) {
      // Cache read failed, continue to fetch
      console.warn('Failed to read model cache:', error);
    }

    setIsLoadingModels(true);
    setModelError(null);

    try {
      // Get API key (client-side or server-side)
      let apiKey: string | null = null;
      if (!serverSideKey) {
        apiKey = getApiKey(providerId);
      }

      // Build query parameters
      const params = new URLSearchParams({ providerId });
      if (apiKey) {
        params.append('apiKey', apiKey);
      }

      const response = await fetch(`/api/models?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch models');
      }

      const data = await response.json();
      const models = data.models || [];

      if (models.length > 0) {
        setAvailableModels(models);
        
        // Cache the models
        try {
          const cacheKey = getCacheKey(providerId);
          const cacheData: CachedModels = {
            models,
            timestamp: Date.now(),
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (error) {
          console.warn('Failed to cache models:', error);
        }

        // Set default model if none selected (check prop first, then local state)
        const latestSelectedModel = selectedModelRef.current;
        const hasSelectedModel = latestSelectedModel || currentSelectedModel;
        if (!hasSelectedModel) {
          const defaultModel = models[0];
          setCurrentSelectedModel(defaultModel);
          onModelChange?.(providerId, defaultModel);
        } else if (latestSelectedModel && latestSelectedModel !== currentSelectedModel) {
          // Sync local state with prop if it changed
          setCurrentSelectedModel(latestSelectedModel);
        }
      } else {
        setModelError('No models available');
      }
    } catch (error) {
      console.error(`Error fetching models for ${providerId}:`, error);
      setModelError(error instanceof Error ? error.message : 'Failed to load models');
      // Don't show error to user, just fall back to default model
    } finally {
      setIsLoadingModels(false);
    }
  }, [isSelected, isAvailable, providerId, serverSideKey, onModelChange, currentSelectedModel]);

  // Fetch models when selection changes
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const model = e.target.value;
    setCurrentSelectedModel(model);
    onModelChange?.(providerId, model);
  };

  if (!provider) return null;

  const baseColors = isSelected 
    ? providerSelectedColors[providerId] 
    : providerColors[providerId];

  const showModelSelector = isSelected && isAvailable && availableModels.length > 0;

  return (
    <div className="flex flex-col h-full">
      <button
        type="button"
        onClick={onClick}
        disabled={!isAvailable}
        className={`
          relative p-4 rounded-xl border transition-all duration-200 text-left h-full flex flex-col
          ${baseColors}
          ${!isSelected ? 'shadow-sm hover:shadow-md hover:-translate-y-0.5' : 'shadow-md'}
          ${isAvailable 
            ? 'cursor-pointer opacity-100' 
            : 'opacity-60 cursor-not-allowed grayscale-[30%]' /* Reduced grayscale to show color hints */
          }
        `}
        title={!isAvailable ? `API key not set for ${provider.displayName}` : ''}
      >
        <div className="flex items-center justify-between w-full mb-2">
          <div className="flex items-center gap-3">
            <div className={`
              w-2.5 h-2.5 rounded-full shadow-sm
              ${isSelected 
                ? 'bg-primary animate-pulse-slow' 
                : 'bg-muted-foreground/30'
              }
            `} />
            <span className="font-semibold text-sm tracking-tight text-foreground">
              {provider.displayName}
            </span>
          </div>
          {isSelected && (
            <div className="text-primary">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
        <div className="text-xs text-muted-foreground pl-5.5">
          {provider.name}
        </div>
      </button>
      
      {showModelSelector && (
        <div className="mt-2 animate-fade-in">
          <select
            value={currentSelectedModel}
            onChange={handleModelChange}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 hover:border-primary/50 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {availableModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
      )}
      
      {isSelected && isAvailable && isLoadingModels && (
        <div className="mt-2 text-xs text-muted-foreground pl-1 animate-pulse">
          Loading models...
        </div>
      )}
      
      {isSelected && isAvailable && modelError && !isLoadingModels && availableModels.length === 0 && (
        <div className="mt-2 text-xs text-amber-500 pl-1">
          Using default model
        </div>
      )}
    </div>
  );
}

