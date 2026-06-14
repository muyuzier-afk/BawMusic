// 构建时抓取 CCTV 频道列表，输出到 public/data/cctv-channels.json
// ESA Pages 是纯静态托管，没有 server runtime；客户端无法跨域拉外部源，
// 所以在 build 阶段用 Node 抓一次数据并打包到 public 里，部署后客户端只
// 要 fetch 同源静态文件即可。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(__dirname, '..', 'public', 'data', 'cctv-channels.json');

const NGZMODS_JSON_URL = 'https://16409.kstore.vip/tv/ngzmods.json';
const TVLIST_PHP_URL_FALLBACK = 'http://38.75.136.137:88/api/tvlist.php';
const CCTV5_M3U8_URL = 'http://82.156.243.185:36888/av3a/cctv5n.m3u8';

const CCTV_NAME_PREFIX = /^CCTV/i;
const BADGE_REGEX = /(HD|4K|8K|\+)/i;

function extractBadge(name) {
  const m = name.match(BADGE_REGEX);
  if (!m) return undefined;
  const upper = m[1].toUpperCase();
  if (upper === 'HD' || upper === '4K' || upper === '8K' || upper === '+') {
    return upper;
  }
  return undefined;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-+]/g, '');
}

function uniqueSlug(base, taken) {
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

function parseTvListText(text) {
  const lines = text.split(/\r?\n/);
  const channels = [];
  const seenNames = new Set();
  const seenIds = new Set();

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.endsWith(',#genre#')) continue;

    const commaIdx = line.indexOf(',');
    if (commaIdx <= 0) continue;

    const name = line.slice(0, commaIdx).trim();
    const url = line.slice(commaIdx + 1).trim();

    if (!name || !url) continue;
    if (!CCTV_NAME_PREFIX.test(name.trim())) continue;
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

async function fetchWithTimeout(url, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 BawTV-Build' },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchMainChannels() {
  const configRes = await fetchWithTimeout(NGZMODS_JSON_URL);
  if (!configRes.ok) {
    throw new Error(`拉取源配置失败: HTTP ${configRes.status}`);
  }
  const config = await configRes.json();
  const livesUrl = config?.lives?.[0]?.url;
  const listUrl = livesUrl || TVLIST_PHP_URL_FALLBACK;

  const listRes = await fetchWithTimeout(listUrl);
  if (!listRes.ok) {
    throw new Error(`拉取频道列表失败: HTTP ${listRes.status}`);
  }
  const text = await listRes.text();
  return parseTvListText(text);
}

function buildBackupChannels() {
  // BACKUP 源只有一个 m3u8 单流，构建时不做可达性检查（避免 CI 抖动）
  // 客户端拉到这条频道后再用 hls.js 加载；失败会触发 VideoPlayer 错误态
  return [
    {
      id: 'cctv-5plus',
      name: 'CCTV-5+',
      url: CCTV5_M3U8_URL,
      badge: '+',
    },
  ];
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const out = { fetchedAt, main: { channels: [], error: null }, backup: { channels: [], error: null } };

  try {
    out.main.channels = await fetchMainChannels();
  } catch (err) {
    out.main.error = err instanceof Error ? err.message : 'unknown';
    console.warn(`[build-cctv-data] MAIN 抓取失败: ${out.main.error}`);
  }

  out.backup.channels = buildBackupChannels();

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf-8');
  console.log(
    `[build-cctv-data] 写入 ${OUT_PATH}  (main=${out.main.channels.length} backup=${out.backup.channels.length})`
  );
}

main().catch((err) => {
  console.error('[build-cctv-data] 失败:', err);
  // 不让构建整体失败：写一份空数据，部署后客户端会显示"暂无频道"提示
  const fallback = {
    fetchedAt: new Date().toISOString(),
    main: { channels: [], error: err?.message ?? 'unknown' },
    backup: { channels: [], error: null },
  };
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(fallback, null, 2) + '\n', 'utf-8');
  process.exit(0);
});
