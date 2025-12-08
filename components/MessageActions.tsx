'use client';

import { useState } from 'react';
import { copyToClipboard, showToast } from '@/lib/utils/clipboard';
import type { Message } from '@/types';

interface MessageActionsProps {
  message: Message;
  onRegenerate?: () => void;
  onDelete?: () => void;
}

export default function MessageActions({ message, onRegenerate, onDelete }: MessageActionsProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(message.content);
    if (success) {
      showToast('Copied to clipboard!');
    } else {
      showToast('Failed to copy');
    }
    // Don't need to set showMenu since we're using hover state
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isHovered && (
        <div className="absolute -top-10 right-0 flex gap-1 bg-gray-800 dark:bg-gray-700 rounded-lg p-1 shadow-lg z-10 animate-fade-in">
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors"
            title="Copy message"
            aria-label="Copy message"
          >
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </button>
          
          {onRegenerate && message.role === 'assistant' && (
            <button
              onClick={() => {
                onRegenerate();
              }}
              className="p-1.5 hover:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors"
              title="Regenerate response"
              aria-label="Regenerate response"
            >
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}
          
          {onDelete && (
            <button
              onClick={() => {
                if (confirm('Delete this message?')) {
                  onDelete();
                }
              }}
              className="p-1.5 hover:bg-red-600 rounded transition-colors"
              title="Delete message"
              aria-label="Delete message"
            >
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

