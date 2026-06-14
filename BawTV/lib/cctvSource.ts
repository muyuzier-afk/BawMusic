// CCTV 源数据解析：从外部源拉取 TVBox 列表 / 单流 m3u8，过滤为 CCTV 频道
// dev 模式的 app/api/cctv-channels/route.ts 引用本文件
// 生产环境由 functions/index.js（ESA Pages ER 函数）独立实现
import type { Channel, ChannelBadge, SourceKey } from '@/types/cctv';

// 数据源 1（MAIN）: TVBox 配置 → 文本格式频道列表
const NGZMODS_JSON_URL = 'https://16409.kstore.vip/tv/ngzmods.json';
const TVLIST_PHP_URL_FALLBACK = 'http://38.75.136.137:88/api/tvlist.php';

// 数据源 2（BACKUP）: CCTV-5 HLS 单流
const CCTV5_M3U8_URL = 'http://82.156.243.185:36888/av3a/cctv5n.m3u8';

const CCTV_NAME_PREFIX = /^CCTV/i;

const BADGE_REGEX = /(HD|4K|8K|\+)/i;

function extractBadge(name: string): ChannelBadge | undefined {
  const m = name.match(BADGE_REGEX);
  if (!m) return undefined;
  const upper = m[1].toUpperCase();
  if (upper === 'HD' || upper === '4K' || upper === '8K' || upper === '+') {
    return upper as ChannelBadge;
  }
  return undefined;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-+]/g, '');
}

// 保证 id 唯一：同 slug 时附加序号
function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  const next = `${base}-${i}`;
  taken.add(next);
  return next;
}

function isCctvLine(name: string): boolean {
  return CCTV_NAME_PREFIX.test(name.trim());
}

// 解析 TVBox 文本格式：分类头 `xxx,#genre#` / 频道行 `name,url`
function parseTvListText(text: string): Channel[] {
  const lines = text.split(/\r?\n/);
  const channels: Channel[] = [];
  const seenNames = new Set<string>();
  const seenIds = new Set<string>();

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.endsWith(',#genre#')) continue;

    const commaIdx = line.indexOf(',');
    if (commaIdx <= 0) continue;

    const name = line.slice(0, commaIdx).trim();
    const url = line.slice(commaIdx + 1).trim();

    if (!name || !url) continue;
    if (!isCctvLine(name)) continue;
    if (!/^https?:\/\//i.test(url)) continue;

    if (seenNames.has(name)) continue;
    seenNames.add(name);

    channels.push({
      id: uniqueSlug(slugify(name), seenIds),
      name,
      url,
      badge: extractBadge(name),
    });
  }

  return channels;
}

type NgzmodsJson = {
  lives?: Array<{ url?: string }>;
};

async function fetchMainChannels(): Promise<Channel[]> {
  // 1) 拉取 TVBox 配置
  const configRes = await fetch(NGZMODS_JSON_URL, {
    cache: 'no-store',
    headers: { 'User-Agent': 'Mozilla/5.0 BawTV' },
  });
  if (!configRes.ok) {
    throw new Error(`拉取源配置失败: HTTP ${configRes.status}`);
  }
  const config = (await configRes.json()) as NgzmodsJson;
  const livesUrl = config?.lives?.[0]?.url;
  const listUrl = livesUrl || TVLIST_PHP_URL_FALLBACK;

  // 2) 拉取频道列表
  const listRes = await fetch(listUrl, {
    cache: 'no-store',
    headers: { 'User-Agent': 'Mozilla/5.0 BawTV' },
  });
  if (!listRes.ok) {
    throw new Error(`拉取频道列表失败: HTTP ${listRes.status}`);
  }
  const text = await listRes.text();
  return parseTvListText(text);
}

async function fetchBackupChannels(): Promise<Channel[]> {
  return [
    {
      id: 'cctv-5plus',
      name: 'CCTV-5+',
      url: CCTV5_M3U8_URL,
      badge: '+',
    },
  ];
}

export async function fetchCctvChannels(source: SourceKey): Promise<Channel[]> {
  if (source === 'main') {
    return fetchMainChannels();
  }
  return fetchBackupChannels();
}
