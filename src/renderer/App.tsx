import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { EmulatorsPage } from './pages/EmulatorsPage';
import { LibraryPage } from './pages/LibraryPage';
import { SettingsPage } from './pages/SettingsPage';
import { ControllerPage } from './pages/ControllerPage';
import { UtilitiesPage } from './pages/UtilitiesPage';
import { useGamepadNav } from './hooks/useGamepadNav';

type Page = 'dashboard' | 'emulators' | 'library' | 'settings' | 'controller' | 'utilities';

export function applyTheme(theme: string) {
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

export function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  const { connected, showLegend, dismissLegend } = useGamepadNav(setCurrentPage, currentPage);

  useEffect(() => {
    window.omni.settings.get().then((s) => applyTheme(s.theme));
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} />;
      case 'emulators':
        return <EmulatorsPage />;
      case 'library':
        return <LibraryPage />;
      case 'settings':
        return <SettingsPage />;
      case 'controller':
        return <ControllerPage />;
      case 'utilities':
        return <UtilitiesPage />;
    }
  };

  const pageTitle: Record<Page, string> = {
    dashboard: 'Dashboard',
    emulators: 'Emulators',
    library: 'Library',
    settings: 'Settings',
    controller: 'Controller',
    utilities: 'Utilities',
  };

  return (
    <div className="app-layout">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <div className="main-content">
        <div className="topbar">
          <h2>{pageTitle[currentPage]}</h2>
        </div>
        <div className="page-content">
          {renderPage()}
        </div>
      </div>

      {connected && showLegend && (
        <div className="controller-legend" onClick={dismissLegend}>
          <span>DPad: Navigate</span>
          <span className="sep">|</span>
          <span>A: Select</span>
          <span className="sep">|</span>
          <span>B/X/Select: Back</span>
          <span className="sep">|</span>
          <span>LB/RB: Tabs</span>
          <span className="sep">|</span>
          <span>Start: Focus</span>
          <span className="sep">|</span>
          <span>Guide: Dashboard</span>
        </div>
      )}
    </div>
  );
}
