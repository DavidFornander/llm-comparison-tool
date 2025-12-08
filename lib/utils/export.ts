/**
 * Export utilities for conversations
 */

import type { Message } from '@/types';
import { providerRegistry } from '@/lib/provider-registry';

/**
 * Export messages as JSON
 */
export function exportAsJSON(messages: Message[]): string {
  return JSON.stringify(messages, null, 2);
}

/**
 * Export messages as Markdown
 */
export function exportAsMarkdown(messages: Message[]): string {
  let markdown = '# LLM Comparison Conversation\n\n';
  
  messages.forEach((message) => {
    if (message.role === 'user') {
      markdown += `## User\n\n${message.content}\n\n`;
    } else {
      const provider = message.providerId 
        ? providerRegistry.get(message.providerId)
        : null;
      const providerName = provider?.displayName || 'Unknown';
      markdown += `### ${providerName}\n\n${message.content}\n\n`;
    }
  });
  
  return markdown;
}

/**
 * Export messages as CSV
 */
export function exportAsCSV(messages: Message[]): string {
  const headers = ['Timestamp', 'Role', 'Provider', 'Content'];
  const rows = messages.map((message) => {
    const provider = message.providerId
      ? providerRegistry.get(message.providerId)?.displayName || message.providerId
      : '';
    
    return [
      new Date(message.timestamp).toISOString(),
      message.role,
      provider,
      `"${message.content.replace(/"/g, '""')}"`, // Escape quotes for CSV
    ];
  });
  
  return [headers, ...rows]
    .map((row) => row.join(','))
    .join('\n');
}

/**
 * Download file with content
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export conversation in specified format
 */
export function exportConversation(messages: Message[], format: 'json' | 'markdown' | 'csv'): void {
  let content: string;
  let filename: string;
  let mimeType: string;
  
  const timestamp = new Date().toISOString().split('T')[0];
  
  switch (format) {
    case 'json':
      content = exportAsJSON(messages);
      filename = `llm-comparison-${timestamp}.json`;
      mimeType = 'application/json';
      break;
    case 'markdown':
      content = exportAsMarkdown(messages);
      filename = `llm-comparison-${timestamp}.md`;
      mimeType = 'text/markdown';
      break;
    case 'csv':
      content = exportAsCSV(messages);
      filename = `llm-comparison-${timestamp}.csv`;
      mimeType = 'text/csv';
      break;
  }
  
  downloadFile(content, filename, mimeType);
}

