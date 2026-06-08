'use client';

import { useEffect, useRef, useState } from 'react';
import type { AudioQuality } from '@/types/music';
import { CheckIcon, DownloadIcon } from './Icons';

export interface DownloadQualityOption {
  value: AudioQuality;
  label: string;
  description: string;
  recommended?: boolean;
}

export const DOWNLOAD_QUALITY_OPTIONS: DownloadQualityOption[] = [
  { value: 'jymaster', label: '超清母带', description: '最高码率，文件较大' },
  { value: 'hires', label: 'Hi-Res', description: '高解析度无损' },
  { value: 'lossless', label: '无损音质', description: 'FLAC，保留原始细节' },
  { value: 'exhigh', label: '极高音质', description: '320kbps MP3' },
  { value: 'standard', label: '标准音质', description: '128kbps MP3，体积小' }
];

interface DownloadMenuProps {
  isOpen: boolean;
  anchorRect: DOMRect | null;
  defaultQuality: AudioQuality;
  busy?: boolean;
  onSelect: (quality: AudioQuality) => void;
  onClose: () => void;
}

export function DownloadMenu({
  isOpen,
  anchorRect,
  defaultQuality,
  busy = false,
  onSelect,
  onClose
}: DownloadMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!isOpen || !anchorRect) {
      setPosition(null);
      return;
    }

    const menuWidth = 280;
    const menuHeight = 320;
    const margin = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = anchorRect.right - menuWidth;
    if (left < margin) left = margin;
    if (left + menuWidth > viewportWidth - margin) {
      left = viewportWidth - menuWidth - margin;
    }

    let top = anchorRect.top - menuHeight - 12;
    if (top < margin) {
      top = anchorRect.bottom + 12;
    }
    if (top + menuHeight > viewportHeight - margin) {
      top = Math.max(margin, viewportHeight - menuHeight - margin);
    }

    setPosition({ top, left });
  }, [isOpen, anchorRect]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: Event) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current && !menuRef.current.contains(target)) {
        const anchor = document.querySelector('[data-download-anchor="true"]');
        if (anchor && anchor.contains(target)) return;
        onClose();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !position) return null;

  return (
    <div
      ref={menuRef}
      className="download-menu glass"
      role="menu"
      aria-label="选择下载音质"
      style={{ top: position.top, left: position.left }}
    >
      <div className="download-menu-header">
        <DownloadIcon size={16} />
        <span>选择下载音质</span>
      </div>
      <div className="download-menu-list">
        {DOWNLOAD_QUALITY_OPTIONS.map((option) => {
          const isDefault = option.value === defaultQuality;
          return (
            <button
              key={option.value}
              type="button"
              className={`download-menu-item ${isDefault ? 'is-default' : ''}`}
              disabled={busy}
              onClick={() => onSelect(option.value)}
            >
              <span className="download-menu-item-main">
                <span className="download-menu-item-label">
                  {option.label}
                  {isDefault && (
                    <span className="download-menu-item-badge" aria-label="推荐">
                      当前
                    </span>
                  )}
                </span>
                <span className="download-menu-item-desc">{option.description}</span>
              </span>
              {isDefault && <CheckIcon size={14} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
