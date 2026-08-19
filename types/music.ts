export type MusicSource = 'netease' | 'kugou' | 'qq';

export const MUSIC_SOURCE_LABELS: Record<MusicSource, string> = {
  netease: '网易云',
  kugou: '酷狗',
  qq: 'QQ 音乐'
};

export interface Song {
  id: string;
  name: string;
  artists: string;
  album: string;
  picUrl: string;
  source: MusicSource;
}

export interface MusicInfo {
  id: string;
  name: string;
  artists: string;
  album: string;
  picUrl: string;
  url: string;
  br: number;
  level: string;
  size: number;
  md5: string;
  source: MusicSource;
}

export type AudioQuality = 'standard' | 'exhigh' | 'lossless' | 'hires' | 'jymaster' | 'sky' | 'jyeffect';

export interface LyricData {
  lrc: string;
  tlyric?: string;
  romalrc?: string;
  klyric?: string;
}

export interface LyricWord {
  /** 开始时间（秒） */
  startTime: number;
  /** 结束时间（秒） */
  endTime: number;
  /** 歌词文本 */
  word: string;
}

export interface LyricLine {
  time: number;
  text: string;
  translation?: string;
  /** 逐字时间戳（可选，来自 klyric）；为空表示该行无逐字数据，按整行高亮 */
  words?: LyricWord[];
}
