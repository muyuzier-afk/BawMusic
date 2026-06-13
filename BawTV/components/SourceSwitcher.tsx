'use client';

import type { SourceKey } from '@/types/cctv';

type Props = {
  value: SourceKey;
  onChange: (next: SourceKey) => void;
  disabled?: boolean;
};

const OPTIONS: Array<{ key: SourceKey; label: string; title: string }> = [
  { key: 'main', label: 'MAIN', title: 'MAIN · 速度较快' },
  { key: 'backup', label: 'BACKUP', title: 'BACKUP · 兜底源' },
];

export function SourceSwitcher({ value, onChange, disabled }: Props) {
  return (
    <div
      className="source-switcher"
      role="radiogroup"
      aria-label="数据源切换"
      aria-disabled={disabled || undefined}
    >
      {OPTIONS.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.title}
            className={`source-segment ${active ? 'active' : ''}`}
            disabled={disabled}
            onClick={() => {
              if (!active && !disabled) onChange(opt.key);
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
