'use client';

import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ReactNode, ComponentPropsWithoutRef } from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Safe markdown renderer for chat messages.
 */
export default function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  type CodeProps = ComponentPropsWithoutRef<'code'> & { inline?: boolean; children?: ReactNode };

  const Code = ({ inline, className: codeClassName, children, ...props }: CodeProps) => {
    if (inline) {
      return (
        <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-100">
          {children}
        </code>
      );
    }

    return (
      <pre className="overflow-x-auto rounded-lg bg-gray-100 p-3 font-mono text-sm text-gray-800 dark:bg-gray-900 dark:text-gray-100">
        <code className={codeClassName} {...props}>
          {children}
        </code>
      </pre>
    );
  };

  const components: Components = {
    code: Code,
    a({ children, href }) {
      return (
        <a
          href={href ?? '#'}
          className="text-blue-600 underline hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
          target="_blank"
          rel="noreferrer noopener"
        >
          {children}
        </a>
      );
    },
    ul({ children }) {
      return <ul className="list-disc space-y-1 pl-5">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="list-decimal space-y-1 pl-5">{children}</ol>;
    },
    blockquote({ children }) {
      return (
        <blockquote className="border-l-4 border-gray-300 pl-3 italic text-gray-700 dark:border-gray-700 dark:text-gray-300">
          {children}
        </blockquote>
      );
    },
    p({ children }) {
      return <p className="leading-7">{children}</p>;
    },
  };

  return (
    <div className={`space-y-3 text-gray-900 dark:text-gray-100 ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // HTML is not rendered; markdown is converted to React elements only.
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

