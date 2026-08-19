'use client';

import { MusicSource, MUSIC_SOURCE_LABELS } from '@/types/music';

const SOURCES: MusicSource[] = ['netease', 'kugou', 'qq'];

interface SourcePickerProps {
  value: MusicSource;
  onChange: (source: MusicSource) => void;
}

export function SourcePicker({ value, onChange }: SourcePickerProps) {
  return (
    <div className="source-picker" role="radiogroup" aria-label="音乐源">
      {SOURCES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          className={`source-picker-item${value === s ? ' source-picker-item--active' : ''}`}
          onClick={() => onChange(s)}
        >
          {MUSIC_SOURCE_LABELS[s]}
        </button>
      ))}
    </div>
  );
}
