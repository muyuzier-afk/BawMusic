// ESA Pages ER 边缘函数入口
// 部署时由 esa.jsonc 的 entry 字段引用
// 路由规则（参考 ESA Pages 文档）：
//   1. 客户端请求先匹配静态资源（out/ 目录）
//   2. 没匹配到时（且不是导航请求）会进入本函数
//   3. 函数返回 Response 时会直接响应客户端
// 实时数据：每次请求都从外部源拉取最新频道列表，不做 build-time 固化
// 注意：ESA 边缘节点禁止访问 privileged port (< 1024)，源 URL 不能带
//       80/88/443 之类的低端口。lives[0].url 如果是 privileged port 会
//       在 fetch 时报错，由外层抛 fetch_failed
const NGZMODS_JSON_URL = 'https://16409.kstore.vip/tv/ngzmods.json';
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

async function fetchWithTimeout(url, ms = 6000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 BawTV-Edge' },
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
  const livesUrl = config && config.lives && config.lives[0] && config.lives[0].url;
  if (!livesUrl) {
    throw new Error('源配置中缺少 lives[0].url');
  }
  const listUrl = livesUrl;

  const listRes = await fetchWithTimeout(listUrl);
  if (!listRes.ok) {
    throw new Error(`拉取频道列表失败: HTTP ${listRes.status}`);
  }
  const text = await listRes.text();
  return parseTvListText(text);
}

function buildBackupChannels() {
  return [
    {
      id: 'cctv-5plus',
      name: 'CCTV-5+',
      url: CCTV5_M3U8_URL,
      badge: '+',
    },
  ];
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/api/cctv-channels') {
      const source = url.searchParams.get('source') || 'main';
      const fetchedAt = new Date().toISOString();

      try {
        let channels;
        if (source === 'main') {
          channels = await fetchMainChannels();
        } else if (source === 'backup') {
          channels = buildBackupChannels();
        } else {
          return jsonResponse(
            {
              error: 'invalid_source',
              message: 'source 必须是 main | backup',
            },
            400
          );
        }
        return jsonResponse({ source, fetchedAt, channels });
      } catch (err) {
        const message = err instanceof Error ? err.message : '拉取频道失败';
        return jsonResponse({ error: 'fetch_failed', message }, 502);
      }
    }

    // 其他路径交由静态资源 / SPA fallback 处理
    return new Response('Not Found', { status: 404 });
  },
};
