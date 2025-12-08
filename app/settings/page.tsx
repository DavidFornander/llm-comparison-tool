'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ChatInterface from '@/components/ChatInterface';

export default function SettingsPage() {
  const router = useRouter();
  useEffect(() => {
    // Redirect to home - settings are now in a modal
    // If there's a query param to open settings, we'll handle it on the home page
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600 dark:text-gray-400">Redirecting to home...</p>
      </div>
    </div>
  );
}

