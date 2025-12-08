'use client';

import type { ProviderId } from '@/types';

interface EmptyStateProps {
  type: 'welcome' | 'no-providers' | 'no-messages';
  selectedProviders?: ProviderId[];
}

export default function EmptyState({ type, selectedProviders = [] }: EmptyStateProps) {
  if (type === 'welcome') {
    const hasSelectedProviders = selectedProviders && selectedProviders.length > 0;
    
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
        <div className="max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
            Welcome to LLM Comparison Tool
          </h2>
          <p className="text-muted-foreground mb-6">
            Compare responses from multiple AI providers side by side. {hasSelectedProviders ? 'Start a conversation below!' : 'Select providers above and start a conversation!'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
            <div className="p-4 bg-card/50 backdrop-blur-sm rounded-xl border border-border/60">
              <h3 className="font-semibold text-foreground mb-2">1. Configure API Keys</h3>
              <p className="text-sm text-muted-foreground">
                Go to Settings and add API keys for the providers you want to compare.
              </p>
            </div>
            <div className="p-4 bg-card/50 backdrop-blur-sm rounded-xl border border-border/60">
              <h3 className="font-semibold text-foreground mb-2">2. Select Providers</h3>
              <p className="text-sm text-muted-foreground">
                Choose which AI providers to compare for each conversation.
              </p>
            </div>
            <div className="p-4 bg-card/50 backdrop-blur-sm rounded-xl border border-border/60">
              <h3 className="font-semibold text-foreground mb-2">3. Start Comparing</h3>
              <p className="text-sm text-muted-foreground">
                Send a message and see how different providers respond to the same prompt.
              </p>
            </div>
            <div className="p-4 bg-card/50 backdrop-blur-sm rounded-xl border border-border/60">
              <h3 className="font-semibold text-foreground mb-2">4. Analyze Results</h3>
              <p className="text-sm text-muted-foreground">
                Compare response quality, tone, and accuracy across providers.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'no-providers') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
        <svg
          className="w-16 h-16 text-muted-foreground mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          No Providers Selected
        </h3>
        <p className="text-muted-foreground mb-4">
          Please select at least one provider to start comparing responses.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
      <svg
        className="w-16 h-16 text-muted-foreground mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
      <h3 className="text-xl font-semibold text-foreground mb-2">
        No Messages Yet
      </h3>
      <p className="text-muted-foreground">
        Start a conversation by sending a message below.
      </p>
    </div>
  );
}

