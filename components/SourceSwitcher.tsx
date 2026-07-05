'use client';

import { type ApiSource } from '@/lib/api';

interface SourceSwitcherProps {
  value: ApiSource;
  onChange: (source: ApiSource) => void;
  disabled?: boolean;
  size?: 'compact' | 'normal';
  className?: string;
}

export function SourceSwitcher({
  value,
  onChange,
  disabled = false,
  size = 'normal',
  className
}: SourceSwitcherProps) {
  return (
    <div
      className={`source-switcher source-switcher-${size}${className ? ` ${className}` : ''}`}
      role="radiogroup"
      aria-label="API 数据源"
    >
      <button
        className={`source-segment ${value === 'main' ? 'active' : ''}`}
        onClick={() => onChange('main')}
        disabled={disabled}
        type="button"
        role="radio"
        aria-checked={value === 'main'}
        title="MAIN · 速度较快"
      >
        MAIN
      </button>
      <button
        className={`source-segment ${value === 'backup' ? 'active' : ''}`}
        onClick={() => onChange('backup')}
        disabled={disabled}
        type="button"
        role="radio"
        aria-checked={value === 'backup'}
        title="BACKUP · 兜底源"
      >
        BACKUP
      </button>
    </div>
  );
}
