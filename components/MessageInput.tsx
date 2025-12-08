'use client';

import { useState, KeyboardEvent, useRef, useEffect } from 'react';

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  maxLength?: number;
}

const MAX_MESSAGE_LENGTH = 10000;

export default function MessageInput({ onSend, disabled, maxLength = MAX_MESSAGE_LENGTH }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSend = () => {
    if (message.trim() && !disabled && message.length <= maxLength) {
      onSend(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= maxLength) {
      setMessage(value);
    }
  };

  const remainingChars = maxLength - message.length;
  const isNearLimit = remainingChars < 100;

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
            disabled={disabled}
            className="
              w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base 
              border border-gray-300 dark:border-gray-600 rounded-lg
              bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              resize-none disabled:opacity-50 disabled:cursor-not-allowed
              min-h-[50px] sm:min-h-[60px] max-h-[200px] overflow-y-auto
              transition-colors
            "
            rows={2}
          />
          {message.length > 0 && (
            <div className={`
              absolute bottom-2 right-2 text-xs
              ${isNearLimit ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}
            `}>
              {remainingChars}
            </div>
          )}
        </div>
        <button
          onClick={handleSend}
          disabled={disabled || !message.trim() || message.length > maxLength}
          className="
            px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base 
            bg-blue-500 text-white rounded-lg
            hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
            transition-all font-medium whitespace-nowrap
            hover:scale-105 active:scale-95
            shadow-sm hover:shadow-md
          "
          aria-label="Send message"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>
      {message.length > maxLength * 0.9 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Message is getting long ({message.length}/{maxLength} characters)
        </p>
      )}
    </div>
  );
}

