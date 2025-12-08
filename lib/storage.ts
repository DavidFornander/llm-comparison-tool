/**
 * Secure storage utility for API keys
 * 
 * WARNING: This implementation uses localStorage which is NOT secure for production use.
 * API keys stored in localStorage can be accessed by any JavaScript running on the page.
 * 
 * For production applications, consider:
 * - Server-side storage with encryption
 * - Environment variables
 * - Secure key management services (AWS Secrets Manager, HashiCorp Vault, etc.)
 * - Encrypted database storage
 */

const STORAGE_PREFIX = 'llm_comparison_';
const API_KEY_SUFFIX = '_api_key';
const DEFAULT_MODEL_SUFFIX = '_default_model';
const PROVIDER_ENABLED_SUFFIX = '_enabled';

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get API key for a provider
 */
export function getApiKey(providerId: string): string | null {
  if (!isLocalStorageAvailable()) {
    throw new StorageError('localStorage is not available');
  }

  try {
    const key = `${STORAGE_PREFIX}${providerId}${API_KEY_SUFFIX}`;
    const value = localStorage.getItem(key);
    return value;
  } catch (error) {
    throw new StorageError(`Failed to retrieve API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Set API key for a provider
 */
export function setApiKey(providerId: string, apiKey: string): void {
  if (!isLocalStorageAvailable()) {
    throw new StorageError('localStorage is not available');
  }

  if (!apiKey || apiKey.trim().length === 0) {
    throw new StorageError('API key cannot be empty');
  }

  try {
    const key = `${STORAGE_PREFIX}${providerId}${API_KEY_SUFFIX}`;
    localStorage.setItem(key, apiKey.trim());
  } catch (error) {
    throw new StorageError(`Failed to store API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Remove API key for a provider
 */
export function removeApiKey(providerId: string): void {
  if (!isLocalStorageAvailable()) {
    throw new StorageError('localStorage is not available');
  }

  try {
    const key = `${STORAGE_PREFIX}${providerId}${API_KEY_SUFFIX}`;
    localStorage.removeItem(key);
  } catch (error) {
    throw new StorageError(`Failed to remove API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if API key exists for a provider
 */
export function hasApiKey(providerId: string): boolean {
  if (!isLocalStorageAvailable()) {
    return false;
  }

  try {
    const key = `${STORAGE_PREFIX}${providerId}${API_KEY_SUFFIX}`;
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

/**
 * Get all stored provider IDs that have API keys
 */
export function getProvidersWithKeys(): string[] {
  if (!isLocalStorageAvailable()) {
    return [];
  }

  const providers: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX) && key.endsWith(API_KEY_SUFFIX)) {
        const providerId = key
          .replace(STORAGE_PREFIX, '')
          .replace(API_KEY_SUFFIX, '');
        providers.push(providerId);
      }
    }
  } catch (error) {
    console.error('Error retrieving providers with keys:', error);
  }

  return providers;
}

/**
 * Get default model for a provider
 */
export function getDefaultModel(providerId: string): string | null {
  if (!isLocalStorageAvailable()) {
    return null;
  }

  try {
    const key = `${STORAGE_PREFIX}${providerId}${DEFAULT_MODEL_SUFFIX}`;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Set default model for a provider
 */
export function setDefaultModel(providerId: string, model: string): void {
  if (!isLocalStorageAvailable()) {
    throw new StorageError('localStorage is not available');
  }

  if (!model || model.trim().length === 0) {
    throw new StorageError('Model cannot be empty');
  }

  try {
    const key = `${STORAGE_PREFIX}${providerId}${DEFAULT_MODEL_SUFFIX}`;
    localStorage.setItem(key, model.trim());
  } catch (error) {
    throw new StorageError(`Failed to store default model: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Remove default model for a provider
 */
export function removeDefaultModel(providerId: string): void {
  if (!isLocalStorageAvailable()) {
    throw new StorageError('localStorage is not available');
  }

  try {
    const key = `${STORAGE_PREFIX}${providerId}${DEFAULT_MODEL_SUFFIX}`;
    localStorage.removeItem(key);
  } catch (error) {
    throw new StorageError(`Failed to remove default model: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if provider is enabled (defaults to true if not set)
 */
export function isProviderEnabled(providerId: string): boolean {
  if (!isLocalStorageAvailable()) {
    return true; // Default to enabled if localStorage unavailable
  }

  try {
    const key = `${STORAGE_PREFIX}${providerId}${PROVIDER_ENABLED_SUFFIX}`;
    const value = localStorage.getItem(key);
    // Default to true if not set (providers are enabled by default)
    return value === null ? true : value === 'true';
  } catch {
    return true; // Default to enabled on error
  }
}

/**
 * Set provider enabled state
 */
export function setProviderEnabled(providerId: string, enabled: boolean): void {
  if (!isLocalStorageAvailable()) {
    throw new StorageError('localStorage is not available');
  }

  try {
    const key = `${STORAGE_PREFIX}${providerId}${PROVIDER_ENABLED_SUFFIX}`;
    localStorage.setItem(key, enabled.toString());
  } catch (error) {
    throw new StorageError(`Failed to store provider enabled state: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get all enabled providers
 */
export function getEnabledProviders(): string[] {
  if (!isLocalStorageAvailable()) {
    return []; // Return empty array if localStorage unavailable
  }

  const enabled: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX) && key.endsWith(PROVIDER_ENABLED_SUFFIX)) {
        const providerId = key
          .replace(STORAGE_PREFIX, '')
          .replace(PROVIDER_ENABLED_SUFFIX, '');
        if (isProviderEnabled(providerId)) {
          enabled.push(providerId);
        }
      }
    }
  } catch (error) {
    console.error('Error retrieving enabled providers:', error);
  }

  return enabled;
}

