import React from 'react';

type Page = 'dashboard' | 'emulators' | 'library' | 'settings' | 'controller' | 'utilities';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { page: Page; label: string; icon: string }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: '📊' },
  { page: 'emulators', label: 'Emulators', icon: '🕹️' },
  { page: 'library', label: 'Game Library', icon: '📚' },
  { page: 'controller', label: 'Controller', icon: '🎮' },
  { page: 'utilities', label: 'Utilities', icon: '🔧' },
  { page: 'settings', label: 'Settings', icon: '⚙️' },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>OmniEmu</h1>
        <p>Cross-platform emulator manager</p>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.page}
            className={`nav-item ${currentPage === item.page ? 'active' : ''}`}
            onClick={() => onNavigate(item.page)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        v0.1.2
      </div>
    </div>
  );
}
