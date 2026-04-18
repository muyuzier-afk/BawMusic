import { Song, MusicInfo, LyricData } from '@/types/music';

const BASE_URL = 'https://api.chksz.top/api';

export async function searchSongs(keyword: string, limit = 30, offset = 0): Promise<Song[]> {
  const response = await fetch(`${BASE_URL}/163_search?keyword=${encodeURIComponent(keyword)}&limit=${limit}&offset=${offset}`);
  const data = await response.json();
  if (data.code === 200) {
    const songs = data.data?.songs || data.data || [];
    return songs.map((s: any) => ({
      id: s.id,
      name: s.name,
      artists: s.artists,
      album: s.album,
      picUrl: s.picUrl
    }));
  }
  throw new Error(data.msg || 'Search failed');
}

export async function getMusicInfo(id: number, level = 'lossless'): Promise<MusicInfo> {
  const response = await fetch(`${BASE_URL}/163_music?id=${id}&level=${level}&type=json`);
  const data = await response.json();
  if (data.code === 200) {
    const d = data.data;
    return {
      id: d.id,
      name: d.name,
      artists: d.artist || d.artists || '',
      album: d.album,
      picUrl: d.picUrl,
      url: d.url,
      br: d.br,
      level: d.level,
      size: d.size,
      md5: d.md5
    };
  }
  throw new Error(data.msg || 'Failed to get music info');
}

export async function getLyric(id: number): Promise<LyricData> {
  const response = await fetch(`${BASE_URL}/163_lyric?id=${id}`);
  const data = await response.json();
  if (data.code === 200) {
    return data.data || { lrc: '', tlyric: '', romalrc: '', klyric: '' };
  }
  throw new Error(data.msg || 'Failed to get lyric');
}

export function parseLyric(lrc: string): { time: number; text: string; translation?: string }[] {
  const lines = lrc.split('\n');
  const result: { time: number; text: string; translation?: string }[] = [];
  
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
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
