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
  openai: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  anthropic: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  google: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  cohere: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  grok: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800',
};

const providerSelectedColors: Record<ProviderId, string> = {
  openai: 'bg-green-100 dark:bg-green-900/40 border-green-500 dark:border-green-600',
  anthropic: 'bg-amber-100 dark:bg-amber-900/40 border-amber-500 dark:border-amber-600',
  google: 'bg-blue-100 dark:bg-blue-900/40 border-blue-500 dark:border-blue-600',
  cohere: 'bg-red-100 dark:bg-red-900/40 border-red-500 dark:border-red-600',
  grok: 'bg-gray-100 dark:bg-gray-900/40 border-gray-500 dark:border-gray-600',
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
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onClick}
        disabled={!isAvailable}
        className={`
          relative p-4 rounded-lg border-2 transition-all text-left
          ${baseColors}
          ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-blue-400' : ''}
          ${isAvailable 
            ? 'hover:scale-105 cursor-pointer' 
            : 'opacity-50 cursor-not-allowed'
          }
          ${isSelected ? 'shadow-md' : 'shadow-sm hover:shadow-md'}
        `}
        title={!isAvailable ? `API key not set for ${provider.displayName}` : ''}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`
              w-3 h-3 rounded-full
              ${isSelected 
                ? 'bg-blue-500 dark:bg-blue-400' 
                : 'bg-gray-300 dark:bg-gray-600'
              }
            `} />
            <div>
              <div className="font-semibold text-gray-900 dark:text-gray-100">
                {provider.displayName}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {provider.name}
              </div>
            </div>
          </div>
          {isSelected && (
            <svg
              className="w-5 h-5 text-blue-500 dark:text-blue-400"
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
        </div>
      </button>
      
      {showModelSelector && (
        <div className="mt-2">
          <select
            value={currentSelectedModel}
            onChange={handleModelChange}
            className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
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
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Loading models...
        </div>
      )}
      
      {isSelected && isAvailable && modelError && !isLoadingModels && availableModels.length === 0 && (
        <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Using default model
        </div>
      )}
      
    </div>
  );
}

