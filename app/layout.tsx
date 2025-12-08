import type { Metadata } from 'next';
import './globals.css';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'LLM Comparison Tool',
  description: 'Compare responses from multiple LLM providers side by side',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            (function() {
              const theme = localStorage.getItem('llm_comparison_theme') || 'system';
              const isDark = theme === 'dark' || 
                (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
              if (isDark) {
                document.documentElement.classList.add('dark');
              }
            })();
          `}
        </Script>
      </head>
      <body suppressHydrationWarning className="bg-background text-foreground min-h-screen antialiased overflow-hidden">{children}</body>
    </html>
  );
}

