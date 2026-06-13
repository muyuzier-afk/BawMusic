// 测速与跳转相关类型
export type PingResult = {
  url: string;             // 目标完整 URL
  ok: boolean;             // 是否成功
  latencyMs: number | null;// 延迟（毫秒），失败 / 超时为 null
  error?: string;          // 失败原因
  samples: number[];       // 每次采样的延迟（毫秒）
};

export type CandidateStatus = 'idle' | 'measuring' | 'success' | 'failed';
