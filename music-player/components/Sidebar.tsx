'use client';

import { MusicIcon, DiscoverIcon, LibraryIcon, LyricIcon } from './Icons';

interface SidebarProps {
  currentView: 'discover' | 'library' | 'lyrics';
  onViewChange: (view: 'discover' | 'library' | 'lyrics') => void;
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  return (
    <nav className="sidebar">
      <div style={{ marginBottom: '24px' }} />
      
      <div
        className={`sidebar-item ${currentView === 'discover' ? 'active' : ''}`}
        onClick={() => onViewChange('discover')}
      >
        <DiscoverIcon size={20} />
        <span>发现</span>
      </div>
      
      <div
        className={`sidebar-item ${currentView === 'library' ? 'active' : ''}`}
        onClick={() => onViewChange('library')}
      >
        <LibraryIcon size={20} />
        <span>音乐库</span>
      </div>
      
      <div
        className={`sidebar-item ${currentView === 'lyrics' ? 'active' : ''}`}
        onClick={() => onViewChange('lyrics')}
      >
        <LyricIcon size={20} />
        <span>歌词</span>
      </div>
    </nav>
  );
}
