// CCTV 频道类型定义
export type ChannelBadge = 'HD' | '4K' | '8K' | '+';

export type Channel = {
  id: string;            // 稳定 ID（频道名 slug）
  name: string;          // 原始频道名（例：CCTV-1HD）
  url: string;           // 直播流地址（m3u8 / m3u 等）
  badge?: ChannelBadge;  // 角标
};

export type SourceKey = 'main' | 'backup';

export type CctvChannelResponse = {
  source: SourceKey;
  fetchedAt: string;
  channels: Channel[];
};

export type CctvErrorResponse = {
  error: string;
  message: string;
};
