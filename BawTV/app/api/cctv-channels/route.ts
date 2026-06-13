import { NextResponse } from 'next/server';
import { fetchCctvChannels } from '@/lib/cctvSource';
import type { CctvChannelResponse, CctvErrorResponse, SourceKey } from '@/types/cctv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_SOURCES: SourceKey[] = ['main', 'backup'];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sourceParam = searchParams.get('source') || 'main';

  if (!VALID_SOURCES.includes(sourceParam as SourceKey)) {
    const body: CctvErrorResponse = {
      error: 'invalid_source',
      message: `source 必须是 ${VALID_SOURCES.join(' | ')}`,
    };
    return NextResponse.json(body, { status: 400 });
  }

  const source = sourceParam as SourceKey;

  try {
    const channels = await fetchCctvChannels(source);
    const body: CctvChannelResponse = {
      source,
      fetchedAt: new Date().toISOString(),
      channels,
    };
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '拉取频道失败';
    const body: CctvErrorResponse = {
      error: 'fetch_failed',
      message,
    };
    // eslint-disable-next-line no-console
    console.error(`[cctv-channels] ${source} 拉取失败:`, err);
    return NextResponse.json(body, { status: 502 });
  }
}
