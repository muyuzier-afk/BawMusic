import { Song, MusicInfo, LyricData, AudioQuality, LyricLine, LyricWord, MusicSource } from '@/types/music';
import { normalizeMediaUrl } from '@/lib/media';
import { useSyncExternalStore } from 'react';

// ============================
// ChKSz API Key 管理
// ============================
// apikey 由用户在首次进入界面时自行填写，持久化到 localStorage，
// 之后可在「设置」中修改。所有请求都会携带 apikey 鉴权参数。

const API_KEY_STORAGE_KEY = 'bawmusic.chkszApiKey';

type ApiKeyListener = (key: string) => void;
const apiKeyListeners = new Set<ApiKeyListener>();

function readPersistedApiKey(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

let currentApiKey = readPersistedApiKey();

export function subscribeApiKey(listener: ApiKeyListener): () => void {
  apiKeyListeners.add(listener);
  return () => {
    apiKeyListeners.delete(listener);
  };
}

export function getApiKey(): string {
  return currentApiKey;
}

export function hasApiKey(): boolean {
  return currentApiKey.trim().length > 0;
}

export function setApiKey(key: string) {
  const next = key.trim();
  currentApiKey = next;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(API_KEY_STORAGE_KEY, next);
    } catch {
      // ignore quota errors
    }
  }
  apiKeyListeners.forEach((listener) => {
    try {
      listener(next);
    } catch {
      // ignore listener errors
    }
  });
}

// 订阅机制：让所有 React 组件能实时感知 apikey 变化
export function useApiKey(): string {
  return useSyncExternalStore(subscribeApiKey, getApiKey, () => '');
}

// ============================
// 公共工具
// ============================

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const API_BASE = 'https://api.chksz.com/api';

function requireApiKey(): string {
  const key = currentApiKey.trim();
  if (!key) {
    throw new Error('请先设置 ChKSz API Key（设置 → API Key）');
  }
  return key;
}

// 响应壳: { code, msg, data: { ... } } 或裸 { data: { ... } } (playlist 接口)
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
  const key = requireApiKey();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    qs.set(k, String(v));
  }
  qs.set('apikey', key);
  const url = `${API_BASE}/${endpoint}?${qs.toString()}`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(err instanceof Error ? `Network error: ${err.message}` : 'Network error');
  }
  if (!response.ok) {
    throw new Error(`ChKSz ${endpoint} failed: HTTP ${response.status}`);
  }
  const payload: unknown = await response.json();
  return parseChkszData<T>(payload);
}

// ============================
// 来源: 网易云 (163_search / 163_music / 163_lyric / 163_playlist)
// ============================

interface ChkszRawSong {
  id: number | string;
  name: string;
  artists?: string;
  artist?: string;
  album?: string;
  picUrl?: string;
  duration?: number;
}

async function neteaseSearch(keyword: string, limit: number, offset: number): Promise<Song[]> {
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
    .filter((s): s is ChkszRawSong => isObject(s) && typeof s.id !== 'undefined' && typeof s.name === 'string')
    .map((s) => ({
      id: String(s.id),
      name: s.name,
      artists: s.artists || s.artist || '',
      album: s.album || '',
      picUrl: normalizeMediaUrl(s.picUrl),
      source: 'netease' as const
    }));
}

interface ChkszRawMusicInfo {
  id: number | string;
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

async function neteaseMusicInfo(id: string, level: AudioQuality): Promise<MusicInfo> {
  const raw = await chkszGet<ChkszRawMusicInfo>('163_music', { id, level, type: 'json' });
  if (!isObject(raw) || typeof raw.name !== 'string' || typeof raw.url !== 'string') {
    throw new Error('Invalid music info payload');
  }
  return {
    id: String(raw.id ?? id),
    name: raw.name,
    artists: raw.artists || raw.artist || '',
    album: raw.album || '',
    picUrl: normalizeMediaUrl(raw.picUrl),
    url: normalizeMediaUrl(raw.url),
    br: typeof raw.br === 'number' ? raw.br : 0,
    level: typeof raw.level === 'string' ? raw.level : level,
    size: typeof raw.size === 'number' ? raw.size : 0,
    md5: typeof raw.md5 === 'string' ? raw.md5 : '',
    source: 'netease' as const
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

async function neteaseLyric(id: string): Promise<LyricData> {
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

async function neteasePlaylist(id: string): Promise<PlaylistInfo> {
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
        id: String(t.id),
        name: t.name,
        artists,
        album: albumName,
        picUrl,
        source: 'netease' as const
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
// 来源: 酷狗 (kugou_music) / QQ 音乐 (qq_music)
// ============================
// 这两个源为「点歌」接口：搜索返回列表（不包含直链），
// 需携带歌曲 id/mid 再次请求才能拿到 url + lrc。解析结果做短期缓存，
// 避免 getMusicInfo 与 getLyric 对同一首歌重复请求。

function mapQualityToSize(level: AudioQuality): string {
  switch (level) {
    case 'standard': return '128k';
    case 'exhigh': return '320k';
    case 'hires': return 'hires';
    case 'jymaster': return 'master';
    case 'lossless':
    case 'sky':
    case 'jyeffect':
    default: return 'flac';
  }
}

interface KugouSearchResponse {
  list?: KugouRawSong[];
}

interface KugouRawSong {
  id?: string;
  name?: string;
  singer?: string;
  album?: string;
  duration?: number;
}

async function kugouSearch(keyword: string, limit: number): Promise<Song[]> {
  const data = await chkszGet<KugouSearchResponse>('kugou_music', { msg: keyword, type: 'json' });
  const list: KugouRawSong[] = Array.isArray(data?.list) ? data.list : [];
  const songs: Song[] = [];
  for (const s of list) {
    if (!isObject(s)) continue;
    const id = s.id;
    const name = s.name;
    if (typeof id === 'undefined' || typeof name !== 'string') continue;
    songs.push({
      id: String(id),
      name,
      artists: typeof s.singer === 'string' ? s.singer : '',
      album: typeof s.album === 'string' ? s.album : '',
      picUrl: '',
      source: 'kugou'
    });
  }
  return songs.slice(0, limit);
}

interface KugouParseResult {
  id?: string;
  name?: string;
  singer?: string;
  album?: string;
  url?: string;
  cover?: string;
  lrc?: string;
  format?: string;
}

async function doKugouParse(id: string, level: AudioQuality): Promise<{ music: MusicInfo; lrc: string }> {
  const raw = await chkszGet<KugouParseResult>('kugou_music', { id, size: mapQualityToSize(level), type: 'json' });
  if (!raw || typeof raw !== 'object' || typeof raw.url !== 'string' || typeof raw.name !== 'string') {
    throw new Error('酷狗歌曲解析失败');
  }
  return {
    music: {
      id: String(raw.id ?? id),
      name: raw.name,
      artists: typeof raw.singer === 'string' ? raw.singer : '',
      album: typeof raw.album === 'string' ? raw.album : '',
      picUrl: normalizeMediaUrl(typeof raw.cover === 'string' ? raw.cover : ''),
      url: normalizeMediaUrl(raw.url),
      br: 0,
      level: typeof raw.format === 'string' ? raw.format : mapQualityToSize(level),
      size: 0,
      md5: '',
      source: 'kugou'
    },
    lrc: typeof raw.lrc === 'string' ? raw.lrc : ''
  };
}

interface QqSearchResponse {
  list?: QqRawSong[];
}

interface QqRawSong {
  mid?: string;
  name?: string;
  singer?: string;
  album?: string;
  pay?: string;
}

async function qqSearch(keyword: string, limit: number): Promise<Song[]> {
  const data = await chkszGet<QqSearchResponse>('qq_music', { msg: keyword, num: limit, type: 'json' });
  const list: QqRawSong[] = Array.isArray(data?.list) ? data.list : [];
  const songs: Song[] = [];
  for (const s of list) {
    if (!isObject(s)) continue;
    const mid = s.mid;
    const name = s.name;
    if (typeof mid === 'undefined' || typeof name !== 'string') continue;
    songs.push({
      id: String(mid),
      name,
      artists: typeof s.singer === 'string' ? s.singer : '',
      album: typeof s.album === 'string' ? s.album : '',
      picUrl: '',
      source: 'qq'
    });
  }
  return songs.slice(0, limit);
}

interface QqParseResult {
  mid?: string;
  name?: string;
  singer?: string;
  album?: string;
  url?: string;
  cover?: string;
  lrc?: string;
  format?: string;
}

async function doQqParse(id: string, level: AudioQuality): Promise<{ music: MusicInfo; lrc: string }> {
  const raw = await chkszGet<QqParseResult>('qq_music', { mid: id, size: mapQualityToSize(level), type: 'json' });
  if (!raw || typeof raw !== 'object' || typeof raw.url !== 'string' || typeof raw.name !== 'string') {
    throw new Error('QQ 音乐歌曲解析失败');
  }
  return {
    music: {
      id: String(raw.mid ?? id),
      name: raw.name,
      artists: typeof raw.singer === 'string' ? raw.singer : '',
      album: typeof raw.album === 'string' ? raw.album : '',
      picUrl: normalizeMediaUrl(typeof raw.cover === 'string' ? raw.cover : ''),
      url: normalizeMediaUrl(raw.url),
      br: 0,
      level: typeof raw.format === 'string' ? raw.format : mapQualityToSize(level),
      size: 0,
      md5: '',
      source: 'qq'
    },
    lrc: typeof raw.lrc === 'string' ? raw.lrc : ''
  };
}

// ---- 解析缓存：source:id:size -> { result, expires }，10 分钟有效 ----
interface ParseCacheEntry {
  result: { music: MusicInfo; lrc: string };
  expires: number;
}

const parseCache = new Map<string, ParseCacheEntry>();
const PARSE_CACHE_TTL = 10 * 60 * 1000;

async function cachedParse(
  key: string,
  fetcher: () => Promise<{ music: MusicInfo; lrc: string }>
): Promise<{ music: MusicInfo; lrc: string }> {
  const hit = parseCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.result;
  const result = await fetcher();
  parseCache.set(key, { result, expires: Date.now() + PARSE_CACHE_TTL });
  if (parseCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of parseCache) {
      if (v.expires <= now) parseCache.delete(k);
    }
  }
  return result;
}

// ============================
// 公共 API
// ============================

export async function searchSongs(
  keyword: string,
  limit = 30,
  offset = 0,
  source: MusicSource = 'netease'
): Promise<Song[]> {
  if (source === 'kugou') return kugouSearch(keyword, limit);
  if (source === 'qq') return qqSearch(keyword, limit);
  return neteaseSearch(keyword, limit, offset);
}

export async function getMusicInfo(
  id: string | number,
  level: AudioQuality = 'lossless',
  source: MusicSource = 'netease'
): Promise<MusicInfo> {
  const sid = String(id);
  if (source === 'kugou') {
    return (await cachedParse(`kugou:${sid}:${level}`, () => doKugouParse(sid, level))).music;
  }
  if (source === 'qq') {
    return (await cachedParse(`qq:${sid}:${level}`, () => doQqParse(sid, level))).music;
  }
  return neteaseMusicInfo(sid, level);
}

export async function getLyric(id: string | number, source: MusicSource = 'netease'): Promise<LyricData> {
  const sid = String(id);
  if (source === 'kugou') {
    const parsed = await cachedParse(`kugou:${sid}:lossless`, () => doKugouParse(sid, 'lossless'));
    return { lrc: parsed.lrc, tlyric: '', romalrc: '', klyric: '' };
  }
  if (source === 'qq') {
    const parsed = await cachedParse(`qq:${sid}:lossless`, () => doQqParse(sid, 'lossless'));
    return { lrc: parsed.lrc, tlyric: '', romalrc: '', klyric: '' };
  }
  return neteaseLyric(sid);
}

export interface PlaylistInfo {
  id: number;
  name: string;
  coverImgUrl: string;
  trackCount: number;
  songs: Song[];
}

export async function fetchPlaylist(playlistId: string | number): Promise<PlaylistInfo> {
  return neteasePlaylist(String(playlistId));
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

/**
 * 解析网易云逐字歌词（klyric）格式：`[mm:ss.ms]词[mm:ss.ms]词...`
 * 返回每行的 { time, words[] }，time 为行首时间（秒），words 时间也为秒
 */
function parseKlyric(klyric: string): Map<string, { time: number; words: LyricWord[] }> {
  const result = new Map<string, { time: number; words: LyricWord[] }>();
  if (typeof klyric !== 'string' || klyric.length === 0) return result;

  const timeRegex = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
  const lines = klyric.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const firstMatch = timeRegex.exec(trimmed);
    if (!firstMatch) continue;
    timeRegex.lastIndex = 0;

    const stamps: { time: number; index: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = timeRegex.exec(trimmed)) !== null) {
      const minutes = parseInt(m[1], 10);
      const seconds = parseInt(m[2], 10);
      const msRaw = m[3] || '0';
      const ms = parseInt(msRaw.padEnd(3, '0').slice(0, 3), 10);
      stamps.push({ time: minutes * 60 + seconds + ms / 1000, index: m.index + m[0].length });
    }
    if (stamps.length === 0) continue;

    const words: LyricWord[] = [];
    for (let i = 0; i < stamps.length; i++) {
      const start = stamps[i].time;
      const textStart = stamps[i].index;
      const nextTagStart = i + 1 < stamps.length
        ? trimmed.lastIndexOf('[', stamps[i + 1].index - 1)
        : trimmed.length;
      const wordText = trimmed.slice(textStart, nextTagStart >= textStart ? nextTagStart : trimmed.length).trim();
      if (!wordText) continue;
      const end = i + 1 < stamps.length ? stamps[i + 1].time : start + 1;
      words.push({ startTime: start, endTime: end, word: wordText });
    }

    if (words.length === 0) continue;
    const lineTime = words[0].startTime;
    result.set(lineTime.toFixed(3), { time: lineTime, words });
  }

  return result;
}

export function parseLyric(lrc: string, tlyric = '', klyric = ''): LyricLine[] {
  if (typeof lrc !== 'string' || lrc.length === 0) return [];

  const lyricLines = parseTimedLyric(lrc);
  if (lyricLines.length === 0) return [];

  const translationMap = new Map(
    parseTimedLyric(tlyric).map((line) => [line.time.toFixed(3), line.text])
  );
  const klyricMap = parseKlyric(klyric);

  return lyricLines.map((line) => {
    const translation = translationMap.get(line.time.toFixed(3));
    const klyricLine = klyricMap.get(line.time.toFixed(3));
    return {
      ...line,
      translation: translation && translation !== line.text ? translation : undefined,
      words: klyricLine?.words,
    };
  });
}
