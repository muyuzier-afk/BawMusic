'use client';

import type { Channel } from '@/types/cctv';

type Props = {
  channels: Channel[];
  currentId: string | null;
  onSelect: (channel: Channel) => void;
};

function badgeClass(badge?: string): string {
  switch (badge) {
    case '4K':
      return 'channel-card-badge badge-4k';
    case '8K':
      return 'channel-card-badge badge-8k';
    case '+':
      return 'channel-card-badge badge-plus';
    default:
      return 'channel-card-badge';
  }
}

export function ChannelGrid({ channels, currentId, onSelect }: Props) {
  return (
    <>
      {channels.map((ch) => {
        const active = ch.id === currentId;
        return (
          <button
            key={ch.id}
            type="button"
            className={`channel-card ${active ? 'active' : ''}`}
            onClick={() => onSelect(ch)}
            title={ch.name}
          >
            <span className="channel-card-name">{ch.name}</span>
            {ch.badge && <span className={badgeClass(ch.badge)}>{ch.badge}</span>}
          </button>
        );
      })}
    </>
  );
}
