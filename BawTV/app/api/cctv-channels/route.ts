import { NextResponse } from 'next/server';
import { fetchCctvChannels } from '@/lib/cctvSource';
import type { CctvChannelResponse, CctvErrorResponse, SourceKey } from '@/types/cctv';

// dev-only Route Handler：生产部署由 functions/index.js（ER 函数）接管
// 这里设置 force-static 仅为了让 next build 在 output: 'export' 下能通过
// dev 模式 next dev 会忽略这个标记直接跑 handler
// 生产部署 ESA Pages 会用 ER 函数响应 /api/cctv-channels，不会走这里
export const runtime = 'edge';
export const dynamic = 'force-static';

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
