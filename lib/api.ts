import { Song, MusicInfo, LyricData, AudioQuality } from '@/types/music';
import { normalizeMediaUrl } from '@/lib/media';
import { useSyncExternalStore } from 'react';

// ============================
// API 源管理
// ============================
// Main (默认)：chksz.top —— chksz.top 自有 163 端点, GET 简单
// Backup：t8.php + meting 混合 —— A(t8) 一次拿全含 tlyric, B(meting) 兜底有 playlist
//
// 切换源：setApiSource('main' | 'backup')，选择会持久化到 localStorage
// 所有公共 API 都会先按当前源尝试，失败时自动降级到另一个源

export type ApiSource = 'main' | 'backup';

const SOURCE_KEY = 'bawmusic.apiSource';

function readPersistedSource(): ApiSource {
  if (typeof localStorage === 'undefined') return 'main';
  const v = localStorage.getItem(SOURCE_KEY);
  return v === 'backup' ? 'backup' : 'main';
}

let currentSource: ApiSource = readPersistedSource();

// 订阅机制：让所有 React 组件能实时感知源切换
type ApiSourceListener = (source: ApiSource) => void;
const apiSourceListeners = new Set<ApiSourceListener>();

export function subscribeApiSource(listener: ApiSourceListener): () => void {
  apiSourceListeners.add(listener);
  return () => {
    apiSourceListeners.delete(listener);
  };
}

export function getApiSource(): ApiSource {
  return currentSource;
}

export function setApiSource(s: ApiSource) {
  if (currentSource === s) {
    // 即使没变也保证 localStorage 写入
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(SOURCE_KEY, s);
      } catch {
        // ignore quota errors
      }
    }
    return;
  }
  currentSource = s;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(SOURCE_KEY, s);
    } catch {
      // ignore quota errors
    }
  }
  apiSourceListeners.forEach((listener) => {
    try {
      listener(s);
    } catch {
      // ignore listener errors
    }
  });
}

export function getApiSourceLabel(s: ApiSource = currentSource): string {
  return s === 'main' ? 'MAIN' : 'BACKUP';
}

export function getApiSourceDescription(s: ApiSource = currentSource): string {
  return s === 'main'
    ? 'MAIN · 速度较快'
    : 'BACKUP · 兜底源';
}

// ============================
// 公共工具
// ============================

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// ============================
// 来源 Main: chksz.top (GET query)
// ============================
// 响应壳: { code, msg, data: { ... } } 或 { data: { ... } } (playlist 接口裸 data)
function parseChkszData<T>(payload: unknown): T {
  if (!isObject(payload)) {
    throw new Error('Invalid API response');
  }
  const envelope = payload as { code?: number; msg?: string; data?: T };
  if (typeof envelope.code === 'number') {
    if (envelope.code !== 200) {
      throw new Error(envelope.msg || 'API request failed');
    }
    if (!isObject(envelope.data)) {
      throw new Error('Empty response payload');
    }
    return envelope.data as T;
  }
  // Bare { data: ... } 形态
  if (isObject(envelope.data)) {
    return envelope.data as T;
  }
  return payload as T;
}

async function chkszGet<T>(endpoint: string, params: Record<string, string | number>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    qs.set(k, String(v));
  }
  const url = `https://api.chksz.top/api/${endpoint}?${qs.toString()}`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(err instanceof Error ? `Network error: ${err.message}` : 'Network error');
  }
  if (!response.ok) {
    throw new Error(`chksz ${endpoint} failed: HTTP ${response.status}`);
  }
  const payload: unknown = await response.json();
  return parseChkszData<T>(payload);
}

interface ChkszRawSong {
  id: number;
  name: string;
  artists?: string;
  artist?: string;
  album?: string;
  picUrl?: string;
  duration?: number;
}

async function chkszSearch(keyword: string, limit: number, offset: number): Promise<Song[]> {
  const data = await chkszGet<{ songs?: ChkszRawSong[] } | ChkszRawSong[]>(
    '163_search',
    { keyword, limit, offset }
  );
  const songs: ChkszRawSong[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.songs)
    ? data.songs
    : [];
  return songs
    .filter((s): s is ChkszRawSong => isObject(s) && typeof s.id === 'number' && typeof s.name === 'string')
    .map((s) => ({
      id: s.id,
      name: s.name,
      artists: s.artists || s.artist || '',
      album: s.album || '',
      picUrl: normalizeMediaUrl(s.picUrl)
    }));
}

interface ChkszRawMusicInfo {
  id: number;
  name: string;
  artists?: string;
  artist?: string;
  album?: string;
  picUrl?: string;
  url?: string;
  br?: number;
  level?: string;
  size?: number;
  md5?: string;
}

async function chkszMusicInfo(id: number, level: AudioQuality): Promise<MusicInfo> {
  const raw = await chkszGet<ChkszRawMusicInfo>('163_music', { id, level, type: 'json' });
  if (!isObject(raw) || typeof raw.id !== 'number' || typeof raw.name !== 'string' || typeof raw.url !== 'string') {
    throw new Error('Invalid music info payload');
  }
  return {
    id: raw.id,
    name: raw.name,
    artists: raw.artists || raw.artist || '',
    album: raw.album || '',
    picUrl: normalizeMediaUrl(raw.picUrl),
    url: normalizeMediaUrl(raw.url),
    br: typeof raw.br === 'number' ? raw.br : 0,
    level: typeof raw.level === 'string' ? raw.level : level,
    size: typeof raw.size === 'number' ? raw.size : 0,
    md5: typeof raw.md5 === 'string' ? raw.md5 : ''
  };
}

interface ChkszRawLyric {
  lrc?: { lyric?: string; content?: string } | string;
  tlyric?: { lyric?: string; content?: string } | string;
  romalrc?: { lyric?: string; content?: string } | string;
  klyric?: { lyric?: string; content?: string } | string;
}

function unwrapLrc(value: ChkszRawLyric['lrc']): string {
  if (typeof value === 'string') return value;
  if (isObject(value)) {
    if (typeof value.lyric === 'string') return value.lyric;
    if (typeof value.content === 'string') return value.content;
  }
  return '';
}

async function chkszLyric(id: number): Promise<LyricData> {
  const raw = await chkszGet<ChkszRawLyric>('163_lyric', { id });
  return {
    lrc: unwrapLrc(raw?.lrc),
    tlyric: unwrapLrc(raw?.tlyric),
    romalrc: unwrapLrc(raw?.romalrc),
    klyric: unwrapLrc(raw?.klyric)
  };
}

interface ChkszRawPlaylistTrack {
  id: number;
  name: string;
  ar?: Array<{ name?: string }>;
  al?: { name?: string; picUrl?: string };
}

interface ChkszRawPlaylistData {
  id: number;
  name: string;
  coverImgUrl?: string;
  trackCount?: number;
  tracks: ChkszRawPlaylistTrack[];
}

async function chkszPlaylist(id: string | number): Promise<PlaylistInfo> {
  const data = await chkszGet<ChkszRawPlaylistData>('163_playlist', { id });
  if (!isObject(data) || !Array.isArray(data.tracks) || data.tracks.length === 0) {
    throw new Error('该歌单暂无歌曲或接口未返回曲目数据');
  }
  const songs: Song[] = data.tracks
    .filter((t) => isObject(t) && typeof t.id === 'number' && typeof t.name === 'string')
    .map((t) => {
      const artists = Array.isArray(t.ar)
        ? t.ar.map((a) => (isObject(a) && typeof a.name === 'string' ? a.name : '')).filter(Boolean).join(' / ')
        : '';
      const albumName = isObject(t.al) && typeof t.al.name === 'string' ? t.al.name : '';
      const picUrl = isObject(t.al) && typeof t.al.picUrl === 'string' ? normalizeMediaUrl(t.al.picUrl) : '';
      return {
        id: t.id,
        name: t.name,
        artists,
        album: albumName,
        picUrl
      };
    });
  if (songs.length === 0) {
    throw new Error('歌单中的曲目数据格式异常，无法解析');
  }
  return {
    id: typeof data.id === 'number' ? data.id : 0,
    name: typeof data.name === 'string' ? data.name : '未知歌单',
    coverImgUrl: typeof data.coverImgUrl === 'string' ? normalizeMediaUrl(data.coverImgUrl) : '',
    trackCount: typeof data.trackCount === 'number' ? data.trackCount : songs.length,
    songs
  };
}

// ============================
// 来源 Backup: t8.php (A) + meting (B)
// ============================

// ---- A: t8.php (POST form-data, 一次拿全, 含 tlyric) ----
const BACKUP_PRIMARY_API = 'https://dev.ciallo.pp.ua/music/t8.php';
const BACKUP_FALLBACK_API = 'https://api.qijieya.cn/meting/';

function mapQualityForT8(level: AudioQuality): string {
  switch (level) {
    case 'standard': return 'standard';
    case 'exhigh': return 'exhigh';
    case 'hires': return 'hires';
    case 'jymaster':
    case 'sky':
    case 'jyeffect': return 'hires';
    case 'lossless':
    default: return 'lossless';
  }
}

function mapQualityForMeting(level: AudioQuality): string {
  switch (level) {
    case 'hires':
    case 'jymaster':
    case 'sky':
    case 'jyeffect':
    case 'lossless': return '2000';
    case 'exhigh':
    case 'standard':
    default: return '320';
  }
}

function unwrapT8<T>(payload: unknown): T {
  if (!isObject(payload)) throw new Error('Invalid API response');
  if (payload.success === false) {
    const msg = typeof payload.message === 'string' ? payload.message : 'API request failed';
    throw new Error(msg);
  }
  if (!isObject(payload.data)) throw new Error('Empty response payload');
  const inner = payload.data as { data?: T };
  if (!('data' in inner)) throw new Error('Missing inner data field');
  return inner.data as T;
}

function trackT8RateLimit(response: Response) {
  const remaining = response.headers.get('X-RateLimit-Remaining');
  if (remaining !== null) {
    const n = parseInt(remaining, 10);
    if (!Number.isNaN(n) && n >= 0 && n < 5) {
      // eslint-disable-next-line no-console
      console.warn(`[t8] 速率限制即将耗尽: 剩余 ${n} 次`);
    }
  }
}

async function t8Request<T>(action: string, params: Record<string, string>): Promise<T> {
  const formData = new FormData();
  for (const [k, v] of Object.entries(params)) formData.append(k, v);
  let response: Response;
  try {
    response = await fetch(`${BACKUP_PRIMARY_API}?action=${action}`, { method: 'POST', body: formData });
  } catch (err) {
    throw new Error(err instanceof Error ? `Network error: ${err.message}` : 'Network error');
  }
  trackT8RateLimit(response);
  if (!response.ok) throw new Error(`t8 ${action} failed: HTTP ${response.status}`);
  return unwrapT8<T>(await response.json());
}

interface T8SearchItem {
  id: number;
  name: string;
  artists: string;
  artist_string?: string;
  album: string;
  picUrl: string;
}
async function t8Search(keyword: string, limit: number): Promise<T8SearchItem[]> {
  return t8Request<T8SearchItem[]>('search', { keyword, limit: String(limit) });
}

interface T8ParseResult {
  id: string;
  name: string;
  ar_name: string;
  al_name: string;
  pic: string;
  url: string;
  level: string;
  quality: string;
  size: string;
  lyric: string;
  tlyric: string;
}
async function t8Parse(id: number | string, level: AudioQuality): Promise<T8ParseResult> {
  return t8Request<T8ParseResult>('parse', { url: String(id), level: mapQualityForT8(level) });
}

// ---- B: meting (GET query, 有 playlist / tencent) ----
interface MetingSong {
  name: string;
  artist: string;
  url: string;
  pic: string;
  lrc: string;
}

async function metingGetList(
  type: 'song' | 'search' | 'playlist',
  params: Record<string, string>
): Promise<MetingSong[]> {
  const qs = new URLSearchParams({ type, server: 'netease', ...params });
  let response: Response;
  try {
    response = await fetch(`${BACKUP_FALLBACK_API}?${qs.toString()}`);
  } catch (err) {
    throw new Error(err instanceof Error ? `Network error: ${err.message}` : 'Network error');
  }
  if (!response.ok) throw new Error(`meting ${type} failed: HTTP ${response.status}`);
  const json: unknown = await response.json();
  if (!Array.isArray(json)) throw new Error('Invalid meting response');
  return json as MetingSong[];
}

async function metingGetText(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(err instanceof Error ? `Network error: ${err.message}` : 'Network error');
  }
  if (!response.ok) throw new Error(`meting sub-request failed: HTTP ${response.status}`);
  return response.text();
}

function extractIdFromMetingUrl(url: string): number {
  try {
    const u = new URL(url);
    const id = u.searchParams.get('id');
    return id ? Number(id) : 0;
  } catch {
    return 0;
  }
}

function parseSizeToBytes(size: string): number {
  const m = size.match(/^([\d.]+)\s*(KB|MB|GB)?$/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return 0;
  const unit = (m[2] || 'MB').toUpperCase();
  if (unit === 'GB') return Math.round(n * 1024 * 1024);
  if (unit === 'KB') return Math.round(n);
  return Math.round(n * 1024);
}

// ---- Backup 高层: A 优先, B 兜底 ----
async function backupSearch(keyword: string, limit: number): Promise<Song[]> {
  // B 优先
  try {
    const list = await metingGetList('search', { id: keyword, limit: String(limit) });
    if (list.length > 0) {
      return list.map((item) => ({
        id: extractIdFromMetingUrl(item.url),
        name: item.name,
        artists: item.artist,
        album: '',
        picUrl: item.pic
      }));
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[backup] meting search failed, falling back to t8:', err);
  }
  // A 兜底
  const list = await t8Search(keyword, limit);
  return list.map((item) => ({
    id: item.id,
    name: item.name,
    artists: item.artists || item.artist_string || '',
    album: item.album || '',
    picUrl: normalizeMediaUrl(item.picUrl)
  }));
}

async function backupMusicInfo(id: number, level: AudioQuality): Promise<MusicInfo> {
  // A 优先
  try {
    const r = await t8Parse(id, level);
    return {
      id: Number(r.id) || id,
      name: r.name,
      artists: r.ar_name || '',
      album: r.al_name || '',
      picUrl: normalizeMediaUrl(r.pic),
      url: normalizeMediaUrl(r.url),
      br: 0,
      level: r.level || mapQualityForT8(level),
      size: parseSizeToBytes(r.size),
      md5: ''
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[backup] t8 parse failed, falling back to meting:', err);
  }
  // B 兜底
  const list = await metingGetList('song', { id: String(id) });
  if (list.length === 0) throw new Error('未找到该歌曲');
  const song = list[0];
  return {
    id,
    name: song.name,
    artists: song.artist,
    album: '',
    picUrl: song.pic,
    url: song.url,
    br: Number(mapQualityForMeting(level)) * 1000,
    level: mapQualityForT8(level),
    size: 0,
    md5: ''
  };
}

async function backupLyric(id: number): Promise<LyricData> {
  // A 优先
  try {
    const r = await t8Parse(id, 'lossless');
    return { lrc: r.lyric || '', tlyric: r.tlyric || '' };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[backup] t8 parse failed, falling back to meting:', err);
  }
  // B 兜底
  try {
    const list = await metingGetList('song', { id: String(id) });
    if (list.length === 0) return { lrc: '', tlyric: '' };
    const lrc = await metingGetText(list[0].lrc);
    return { lrc, tlyric: '' };
  } catch {
    return { lrc: '', tlyric: '' };
  }
}

async function backupPlaylist(id: string | number): Promise<PlaylistInfo> {
  // B 是唯一有 playlist 端点的源
  const list = await metingGetList('playlist', { id: String(id), limit: '1000' });
  if (list.length === 0) throw new Error('该歌单暂无歌曲或接口未返回数据');
  return {
    id: Number(id) || 0,
    name: `歌单 ${id}`,
    coverImgUrl: '',
    trackCount: list.length,
    songs: list.map((item) => ({
      id: extractIdFromMetingUrl(item.url),
      name: item.name,
      artists: item.artist,
      album: '',
      picUrl: item.pic
    }))
  };
}

// ============================
// 公共 API (按当前源路由, 失败自动降级)
// ============================

export async function searchSongs(keyword: string, limit = 30, offset = 0): Promise<Song[]> {
  if (currentSource === 'main') {
    try {
      return await chkszSearch(keyword, limit, offset);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[searchSongs] main failed, falling back to backup:', err);
    }
  } else {
    try {
      return await backupSearch(keyword, limit);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[searchSongs] backup failed, falling back to main:', err);
    }
  }
  // 跨源降级
  return currentSource === 'main' ? backupSearch(keyword, limit) : chkszSearch(keyword, limit, offset);
}

export async function getMusicInfo(id: number, level: AudioQuality = 'lossless'): Promise<MusicInfo> {
  if (currentSource === 'main') {
    try {
      return await chkszMusicInfo(id, level);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[getMusicInfo] main failed, falling back to backup:', err);
    }
  } else {
    try {
      return await backupMusicInfo(id, level);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[getMusicInfo] backup failed, falling back to main:', err);
    }
  }
  return currentSource === 'main' ? backupMusicInfo(id, level) : chkszMusicInfo(id, level);
}

export async function getLyric(id: number): Promise<LyricData> {
  if (currentSource === 'main') {
    try {
      return await chkszLyric(id);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[getLyric] main failed, falling back to backup:', err);
    }
  } else {
    try {
      return await backupLyric(id);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[getLyric] backup failed, falling back to main:', err);
    }
  }
  return currentSource === 'main' ? backupLyric(id) : chkszLyric(id);
}

// ============================
// 歌词解析
// ============================

function parseTimedLyric(lrc: string): { time: number; text: string }[] {
  const lines = lrc.split(/\r?\n/);
  const result: { time: number; text: string }[] = [];

  const timeRegex = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
  const metaTagRegex = /^\[[a-zA-Z]+:[^\]]*\]$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || metaTagRegex.test(trimmed)) continue;

    const timeMatches = [...trimmed.matchAll(timeRegex)];
    if (timeMatches.length === 0) continue;

    const text = trimmed.replace(timeRegex, '').trim();
    if (!text) continue;

    for (const match of timeMatches) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const msRaw = match[3] || '0';
      const ms = parseInt(msRaw.padEnd(3, '0').slice(0, 3), 10);
      const time = minutes * 60 + seconds + ms / 1000;
      result.push({ time, text });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

export function parseLyric(lrc: string, tlyric = ''): { time: number; text: string; translation?: string }[] {
  if (typeof lrc !== 'string' || lrc.length === 0) return [];

  const lyricLines = parseTimedLyric(lrc);
  if (lyricLines.length === 0) return [];

  const translationMap = new Map(
    parseTimedLyric(tlyric).map((line) => [line.time.toFixed(3), line.text])
  );

  return lyricLines.map((line) => {
    const translation = translationMap.get(line.time.toFixed(3));
    return {
      ...line,
      translation: translation && translation !== line.text ? translation : undefined
    };
  });
}

// ============================
// Playlist import
// ============================

export interface PlaylistInfo {
  id: number;
  name: string;
  coverImgUrl: string;
  trackCount: number;
  songs: Song[];
}

export async function fetchPlaylist(playlistId: string | number): Promise<PlaylistInfo> {
  if (currentSource === 'main') {
    try {
      return await chkszPlaylist(playlistId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[fetchPlaylist] main failed, falling back to backup:', err);
    }
  } else {
    try {
      return await backupPlaylist(playlistId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[fetchPlaylist] backup failed, falling back to main:', err);
    }
  }
  return currentSource === 'main' ? backupPlaylist(playlistId) : chkszPlaylist(playlistId);
}

export function extractPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const id = url.searchParams.get('id');
    if (id && /^\d+$/.test(id)) return id;
  } catch {
    // ignore invalid URL
  }
  return null;
}

// ============================
// React 集成：保证 UI 与模块级 currentSource 始终一致
// ============================
// 修复：刷新页面后 React state 与 模块级 currentSource 不一致的 bug。
// 旧实现 useState(() => getApiSource()) 会在 SSR 渲染时取 'main'，客户端 hydrate 时
// 直接复用该 state，导致 UI 与实际 API 行为不同步。
// 这里用 useSyncExternalStore 把 React state 绑定到 currentSource 的订阅上。

export function useApiSource(): ApiSource {
  return useSyncExternalStore(
    subscribeApiSource,
    getApiSource,
    () => 'main'
  );
}
