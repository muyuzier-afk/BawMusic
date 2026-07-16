import type { LyricLine as AmllLyricLine, LyricWord as AmllLyricWord } from '@applemusic-like-lyrics/core';
import type { LyricLine } from '@/types/music';

/**
 * 将项目内部 LyricLine[] 转换为 AMLL LyricPlayer 所需的 LyricLine[]。
 *
 * - 时间从秒转换为毫秒（AMLL 要求整数毫秒）
 * - 若原行含逐字 words，转为 AMLL LyricWord[]；否则将整行文本包装成单个 word
 * - endTime 由下一行 startTime 推算，最后一行用 duration 或 +5s 兜底
 * - translation → translatedLyric
 *
 * 注意：AMLL 要求传入后数组内部信息不得修改，故每次都返回新数组。
 */
export function toAmllLyricLines(
  lines: LyricLine[],
  durationSec: number,
): AmllLyricLine[] {
  if (lines.length === 0) return [];

  const result: AmllLyricLine[] = [];
  const lastEndMs = Math.max(durationSec, lines[lines.length - 1].time + 5) * 1000;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const startTimeMs = Math.round(line.time * 1000);
    const nextStartMs = i + 1 < lines.length
      ? Math.round(lines[i + 1].time * 1000)
      : lastEndMs;
    const endTimeMs = Math.max(nextStartMs, startTimeMs + 100);

    let words: AmllLyricWord[];
    if (line.words && line.words.length > 0) {
      // 逐字模式
      words = line.words.map((w, idx) => {
        const wStart = Math.round(w.startTime * 1000);
        const wEnd = idx + 1 < line.words!.length
          ? Math.round(line.words![idx + 1].startTime * 1000)
          : Math.round(w.endTime * 1000);
        return {
          startTime: wStart,
          endTime: Math.max(wEnd, wStart + 50),
          word: w.word,
        };
      });
    } else {
      // 整行模式：单个 word 撑满整行
      words = [{
        startTime: startTimeMs,
        endTime: endTimeMs,
        word: line.text,
      }];
    }

    result.push({
      words,
      translatedLyric: line.translation ?? '',
      romanLyric: '',
      startTime: startTimeMs,
      endTime: endTimeMs,
      isBG: false,
      isDuet: false,
    });
  }

  return result;
}
