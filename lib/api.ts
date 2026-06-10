import { Song, MusicInfo, LyricData, AudioQuality } from '@/types/music';
import { normalizeMediaUrl } from '@/lib/media';

const BASE_URL = 'https://api.chksz.top/api';

interface RawApiResponse<T> {
  code: number;
  msg?: string;
  data?: T;
}

interface RawSong {
  id: number;
  name: string;
  artists?: string | { name: string }[];
  artist?: string;
  album?: string;
  picUrl?: string;
}

interface RawMusicInfo {
  id: number;
  name: string;
  artists?: string | { name: string }[];
  artist?: string;
  album?: string;
  picUrl?: string;
  url?: string;
  br?: number;
  level?: string;
  size?: number;
  md5?: string;
}

interface RawLyricField {
  lyric?: string;
  content?: string;
}

interface RawLyric {
  lrc?: RawLyricField | string;
  tlyric?: RawLyricField | string;
  romalrc?: RawLyricField | string;
  klyric?: RawLyricField | string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function unwrapLrc(value: RawLyric['lrc']): string {
  if (typeof value === 'string') return value;
  if (isObject(value)) {
    if (typeof value.lyric === 'string') return value.lyric;
    if (typeof value.content === 'string') return value.content;
  }
  return '';
}

function joinArtists(value: RawSong['artists'] | RawMusicInfo['artists']): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((entry) => (isObject(entry) && typeof entry.name === 'string' ? entry.name : ''))
      .filter(Boolean)
      .join(' / ');
  }
  return '';
}

function parseApiData<T>(payload: unknown): T {
  if (!isObject(payload)) {
    throw new Error('Invalid API response');
  }
  const envelope = payload as unknown as RawApiResponse<T>;
  // Accept either { code: 200, data: ... } or bare { data: ... } shapes.
  if (typeof envelope.code === 'number') {
    if (envelope.code !== 200) {
      throw new Error(envelope.msg || 'API request failed');
    }
    return envelope.data as T;
  }
  if ('data' in envelope && envelope.data !== undefined) {
    return envelope.data as T;
  }
  return payload as T;
}

export async function searchSongs(keyword: string, limit = 30, offset = 0): Promise<Song[]> {
  let response: Response;
  try {
    response = await fetch(
      `${BASE_URL}/163_search?keyword=${encodeURIComponent(keyword)}&limit=${limit}&offset=${offset}`
    );
  } catch (err) {
    throw new Error(err instanceof Error ? `Network error: ${err.message}` : 'Network error');
  }

  if (!response.ok) {
    throw new Error(`Search failed: HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  const data = parseApiData<{ songs?: RawSong[] } | RawSong[]>(payload);
  const songs: RawSong[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { songs?: RawSong[] })?.songs)
    ? (data as { songs: RawSong[] }).songs
    : [];

  return songs
    .filter((s): s is RawSong => isObject(s) && typeof s.id === 'number' && typeof s.name === 'string')
    .map((s) => {
      const artists = joinArtists(s.artists) || s.artist || '';
      return {
        id: s.id,
        name: s.name,
        artists,
        album: typeof s.album === 'string' ? s.album : '',
        picUrl: normalizeMediaUrl(s.picUrl)
      };
    });
}

export async function getMusicInfo(id: number, level: AudioQuality = 'lossless'): Promise<MusicInfo> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/163_music?id=${id}&level=${level}&type=json`);
  } catch (err) {
    throw new Error(err instanceof Error ? `Network error: ${err.message}` : 'Network error');
  }

  if (!response.ok) {
    throw new Error(`Failed to get music info: HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  const raw = parseApiData<RawMusicInfo>(payload);

  if (!isObject(raw) || typeof raw.id !== 'number' || typeof raw.name !== 'string' || typeof raw.url !== 'string') {
    throw new Error('Invalid music info payload');
  }

  const artists = joinArtists(raw.artists) || raw.artist || '';

  return {
    id: raw.id,
    name: raw.name,
    artists,
    album: typeof raw.album === 'string' ? raw.album : '',
    picUrl: normalizeMediaUrl(raw.picUrl),
    url: normalizeMediaUrl(raw.url),
    br: typeof raw.br === 'number' ? raw.br : 0,
    level: typeof raw.level === 'string' ? raw.level : level,
    size: typeof raw.size === 'number' ? raw.size : 0,
    md5: typeof raw.md5 === 'string' ? raw.md5 : ''
  };
}

export async function getLyric(id: number): Promise<LyricData> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/163_lyric?id=${id}`);
  } catch (err) {
    throw new Error(err instanceof Error ? `Network error: ${err.message}` : 'Network error');
  }

  if (!response.ok) {
    throw new Error(`Failed to get lyric: HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  const raw = parseApiData<RawLyric>(payload);

  return {
    lrc: unwrapLrc(raw?.lrc),
    tlyric: unwrapLrc(raw?.tlyric),
    romalrc: unwrapLrc(raw?.romalrc),
    klyric: unwrapLrc(raw?.klyric)
  };
}

function parseTimedLyric(lrc: string): { time: number; text: string }[] {
  const lines = lrc.split(/\r?\n/);
  const result: { time: number; text: string }[] = [];

  // Accept [mm:ss.xx], [mm:ss:xx], [m:ss.xxx] etc. Minutes/seconds may be 1 or 2 digits.
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

interface RawPlaylistTrack {
  id?: number;
  name?: string;
  ar?: Array<{ name?: string }>;
  al?: { name?: string; picUrl?: string };
}

interface RawPlaylistData {
  id?: number;
  name?: string;
  coverImgUrl?: string;
  trackCount?: number;
  tracks?: RawPlaylistTrack[];
}

export interface PlaylistInfo {
  id: number;
  name: string;
  coverImgUrl: string;
  trackCount: number;
  songs: Song[];
}

export async function fetchPlaylist(playlistId: string | number): Promise<PlaylistInfo> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/163_playlist?id=${encodeURIComponent(String(playlistId))}`);
  } catch (err) {
    throw new Error(err instanceof Error ? `Network error: ${err.message}` : 'Network error');
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch playlist: HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();

  // Debug: log raw payload shape when tracks are missing or empty
  if (isObject(payload) && isObject((payload as Record<string, unknown>).data)) {
    const d = (payload as Record<string, unknown>).data as Record<string, unknown>;
    if (!Array.isArray(d.tracks) || d.tracks.length === 0) {
      // eslint-disable-next-line no-console
      console.warn('[fetchPlaylist] API returned no tracks. Raw data keys:', Object.keys(d));
    }
  }

  const data = parseApiData<RawPlaylistData>(payload);

  if (!isObject(data)) {
    throw new Error('Invalid playlist payload');
  }

  const tracks: RawPlaylistTrack[] = Array.isArray(data.tracks) ? data.tracks : [];

  if (tracks.length === 0) {
    throw new Error('该歌单暂无歌曲或接口未返回曲目数据');
  }

  const songs: Song[] = tracks
    .filter(
      (t): t is RawPlaylistTrack =>
        isObject(t) && typeof t.id === 'number' && typeof t.name === 'string'
    )
    .map((t) => {
      const artists = Array.isArray(t.ar)
        ? t.ar
            .map((a) => (isObject(a) && typeof a.name === 'string' ? a.name : ''))
            .filter(Boolean)
            .join(' / ')
        : '';
      const albumName = isObject(t.al) && typeof t.al.name === 'string' ? t.al.name : '';
      const picUrl = isObject(t.al) && typeof t.al.picUrl === 'string' ? normalizeMediaUrl(t.al.picUrl) : '';
      return {
        id: t.id as number,
        name: t.name as string,
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

export function extractPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    const id = url.searchParams.get('id');
    if (id && /^\d+$/.test(id)) {
      return id;
    }
  } catch {
    // ignore invalid URL
  }
  return null;
}
