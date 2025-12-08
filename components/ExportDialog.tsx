'use client';

import { useState } from 'react';
import { exportConversation } from '@/lib/utils/export';
import type { Message } from '@/types';

interface ExportDialogProps {
  messages: Message[];
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportDialog({ messages, isOpen, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<'json' | 'markdown' | 'csv'>('json');

  if (!isOpen) return null;

  const handleExport = () => {
    if (messages.length === 0) {
      alert('No messages to export');
      return;
    }
    exportConversation(messages, format);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Export Conversation
        </h2>
        
        <div className="space-y-3 mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Export Format
          </label>
          
          <div className="space-y-2">
            <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
              <input
                type="radio"
                name="format"
                value="json"
                checked={format === 'json'}
                onChange={(e) => setFormat(e.target.value as 'json')}
                className="mr-3"
              />
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">JSON</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Structured data format</div>
              </div>
            </label>
            
            <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
              <input
                type="radio"
                name="format"
                value="markdown"
                checked={format === 'markdown'}
                onChange={(e) => setFormat(e.target.value as 'markdown')}
                className="mr-3"
              />
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Markdown</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Human-readable format</div>
              </div>
            </label>
            
            <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
              <input
                type="radio"
                name="format"
                value="csv"
                checked={format === 'csv'}
                onChange={(e) => setFormat(e.target.value as 'csv')}
                className="mr-3"
              />
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">CSV</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Spreadsheet format</div>
              </div>
            </label>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

