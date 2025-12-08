import { NextRequest, NextResponse } from 'next/server';
import config from '@/lib/config';
import type { ProviderId } from '@/types';

/**
 * GET /api/keys - Check which providers have server-side API keys configured
 * This endpoint allows the client to check if server-side keys are available
 */
export async function GET(request: NextRequest) {
  try {
    const availableKeys: Record<ProviderId, boolean> = {
      openai: Boolean(config.apiKeys.openai),
      anthropic: Boolean(config.apiKeys.anthropic),
      google: Boolean(config.apiKeys.google),
      cohere: Boolean(config.apiKeys.cohere),
      grok: Boolean(config.apiKeys.grok),
    };

    return NextResponse.json({ availableKeys });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check API keys' },
      { status: 500 }
    );
  }
}

