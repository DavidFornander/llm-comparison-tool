'use client';

import { useState } from 'react';
import { formatErrorMessage, type ErrorType } from '@/lib/utils/error-formatter';

interface ErrorDisplayProps {
  error: string;
  onDismiss?: () => void;
  onRetry?: () => void;
  variant?: 'banner' | 'inline' | 'message';
  showDetails?: boolean;
  providerName?: string;
  className?: string;
}

const errorTypeConfig: Record<
  ErrorType,
  { icon: JSX.Element; bgColor: string; borderColor: string; textColor: string }
> = {
  network: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
        />
      </svg>
    ),
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
    textColor: 'text-orange-800 dark:text-orange-200',
  },
  authentication: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    ),
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    textColor: 'text-red-800 dark:text-red-200',
  },
  'rate-limit': {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    textColor: 'text-yellow-800 dark:text-yellow-200',
  },
  quota: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
    textColor: 'text-purple-800 dark:text-purple-200',
  },
  timeout: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-800 dark:text-blue-200',
  },
  validation: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    textColor: 'text-amber-800 dark:text-amber-200',
  },
  api: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    textColor: 'text-red-800 dark:text-red-200',
  },
  'content-safety': {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
    textColor: 'text-orange-800 dark:text-orange-200',
  },
  unknown: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    bgColor: 'bg-gray-50 dark:bg-gray-900/20',
    borderColor: 'border-gray-200 dark:border-gray-800',
    textColor: 'text-gray-800 dark:text-gray-200',
  },
};

export default function ErrorDisplay({
  error,
  onDismiss,
  onRetry,
  variant = 'banner',
  showDetails: initialShowDetails = false,
  providerName,
  className = '',
}: ErrorDisplayProps) {
  const formattedError = formatErrorMessage(error);
  const [showDetails, setShowDetails] = useState(initialShowDetails);
  const config = errorTypeConfig[formattedError.type];

  if (variant === 'banner') {
    return (
      <div
        className={`${config.bgColor} ${config.borderColor} border-b px-4 sm:px-6 py-3 ${className}`}
        role="alert"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <div className={`${config.textColor} flex-shrink-0 mt-0.5`}>{config.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                {providerName && (
                  <div className={`text-xs font-semibold ${config.textColor} mb-1`}>
                    {providerName}
                  </div>
                )}
                <p className={`${config.textColor} text-sm font-medium break-words whitespace-pre-wrap`}>
                  {formattedError.userMessage}
                </p>
                {formattedError.suggestion && (
                  <p className={`${config.textColor} text-xs mt-2 opacity-80`}>
                    {formattedError.suggestion}
                  </p>
                )}
                {formattedError.technicalDetails && (
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className={`${config.textColor} text-xs mt-2 underline opacity-70 hover:opacity-100 transition-opacity`}
                    aria-expanded={showDetails}
                  >
                    {showDetails ? 'Hide' : 'Show'} technical details
                  </button>
                )}
                {showDetails && formattedError.technicalDetails && (
                  <div className={`${config.textColor} text-xs mt-2 font-mono bg-black/5 dark:bg-white/5 p-2 rounded break-all`}>
                    {formattedError.technicalDetails}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {formattedError.canRetry && onRetry && (
                  <button
                    onClick={onRetry}
                    className={`${config.textColor} hover:opacity-80 transition-opacity px-2 py-1 text-xs font-medium rounded`}
                    aria-label="Retry"
                  >
                    Retry
                  </button>
                )}
                {onDismiss && (
                  <button
                    onClick={onDismiss}
                    className={`${config.textColor} hover:opacity-80 transition-opacity`}
                    aria-label="Dismiss error"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div
        className={`${config.bgColor} ${config.borderColor} border-2 rounded-lg px-3 py-2 ${className}`}
        role="alert"
      >
        <div className="flex items-start gap-2">
          <div className={`${config.textColor} flex-shrink-0 mt-0.5`}>
            {config.icon}
          </div>
          <div className="flex-1 min-w-0">
            {providerName && (
              <div className={`text-xs font-semibold ${config.textColor} mb-1`}>
                {providerName}
              </div>
            )}
            <p className={`${config.textColor} text-sm font-medium break-words whitespace-pre-wrap`}>
              {formattedError.userMessage}
            </p>
            {formattedError.suggestion && (
              <p className={`${config.textColor} text-xs mt-1.5 opacity-80`}>
                {formattedError.suggestion}
              </p>
            )}
            {formattedError.technicalDetails && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className={`${config.textColor} text-xs mt-1.5 underline opacity-70 hover:opacity-100 transition-opacity`}
                aria-expanded={showDetails}
              >
                {showDetails ? 'Hide' : 'Show'} details
              </button>
            )}
            {showDetails && formattedError.technicalDetails && (
              <div className={`${config.textColor} text-xs mt-1.5 font-mono bg-black/5 dark:bg-white/5 p-2 rounded break-all`}>
                {formattedError.technicalDetails}
              </div>
            )}
            {formattedError.canRetry && onRetry && (
              <button
                onClick={onRetry}
                className={`${config.textColor} hover:opacity-80 transition-opacity mt-2 text-xs font-medium underline`}
                aria-label="Retry"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // message variant (for message bubbles)
  return (
    <div
      className={`${config.bgColor} ${config.borderColor} border-2 rounded-2xl rounded-tl-sm px-4 py-3 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-2 mb-2">
        <div className={`${config.textColor} flex-shrink-0`}>{config.icon}</div>
        <div className="flex-1 min-w-0">
          {providerName && (
            <div className={`text-xs font-semibold ${config.textColor} mb-1`}>
              {providerName}
            </div>
          )}
          <p className={`${config.textColor} text-sm font-medium break-words whitespace-pre-wrap`}>
            {formattedError.userMessage}
          </p>
          {formattedError.suggestion && (
            <p className={`${config.textColor} text-xs mt-2 opacity-80`}>
              {formattedError.suggestion}
            </p>
          )}
          {formattedError.technicalDetails && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className={`${config.textColor} text-xs mt-2 underline opacity-70 hover:opacity-100 transition-opacity`}
              aria-expanded={showDetails}
            >
              {showDetails ? 'Hide' : 'Show'} technical details
            </button>
          )}
          {showDetails && formattedError.technicalDetails && (
            <div className={`${config.textColor} text-xs mt-2 font-mono bg-black/5 dark:bg-white/5 p-2 rounded break-all`}>
              {formattedError.technicalDetails}
            </div>
          )}
        </div>
      </div>
      {formattedError.canRetry && onRetry && (
        <button
          onClick={onRetry}
          className={`${config.textColor} hover:opacity-80 transition-opacity text-xs font-medium underline`}
          aria-label="Retry"
        >
          Retry request
        </button>
      )}
    </div>
  );
}

