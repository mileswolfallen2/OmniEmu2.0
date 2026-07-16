import React from 'react';

type Page = 'dashboard' | 'emulators' | 'library' | 'saves' | 'cloud' | 'settings' | 'controller' | 'utilities';

interface TopBarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { page: Page; label: string; icon: string }[] = [
  { page: 'dashboard', label: 'Home', icon: '🏠' },
  { page: 'emulators', label: 'Emulators', icon: '🕹️' },
  { page: 'library', label: 'Library', icon: '📚' },
  { page: 'saves', label: 'Saves', icon: '💾' },
  { page: 'cloud', label: 'Cloud Sync', icon: '☁️' },
  { page: 'controller', label: 'Controller', icon: '🎮' },
  { page: 'utilities', label: 'Utilities', icon: '🔧' },
  { page: 'settings', label: 'Settings', icon: '⚙️' },
];

export function Sidebar({ currentPage, onNavigate }: TopBarProps) {
  return (
    <div className="topbar-nav">
      <div className="topbar-brand">OmniEmu</div>
      <nav className="topbar-tabs">
        {navItems.map((item) => (
          <button
            key={item.page}
            className={`topbar-tab ${currentPage === item.page ? 'active' : ''}`}
            onClick={() => onNavigate(item.page)}
          >
            <span className="topbar-tab-icon">{item.icon}</span>
            <span className="topbar-tab-label">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="topbar-version">v0.3.2</div>
    </div>
  );
}
