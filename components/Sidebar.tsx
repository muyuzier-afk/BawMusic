'use client';

import { DiscoverIcon, LibraryIcon } from './Icons';

interface SidebarProps {
  currentView: 'discover' | 'library';
  onViewChange: (view: 'discover' | 'library') => void;
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
      
    </nav>
  );
}
