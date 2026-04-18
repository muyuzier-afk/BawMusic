export interface Song {
  id: number;
  name: string;
  artists: string;
  album: string;
  picUrl: string;
}

export interface MusicInfo {
  id: number;
  name: string;
  artists: string;
  album: string;
  picUrl: string;
  url: string;
  br: number;
  level: string;
  size: number;
  md5: string;
}

export interface LyricData {
  lrc: string;
  tlyric?: string;
  romalrc?: string;
  klyric?: string;
}

export interface LyricLine {
  time: number;
  text: string;
  translation?: string;
}

export interface PlayerState {
  currentSong: MusicInfo | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isShuffle: boolean;
  isRepeat: boolean;
  playlist: Song[];
  currentIndex: number;
  lyric: LyricLine[];
  isLoading: boolean;
}
