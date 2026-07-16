import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dashboard } from './pages/Dashboard';
import { EmulatorsPage } from './pages/EmulatorsPage';
import { LibraryPage } from './pages/LibraryPage';
import { SettingsPage } from './pages/SettingsPage';
import { ControllerPage } from './pages/ControllerPage';
import { UtilitiesPage } from './pages/UtilitiesPage';
import { SaveManagerPage } from './pages/SaveManagerPage';
import { CloudSyncPage } from './pages/CloudSyncPage';
import { InstallerPage } from './pages/InstallerPage';
import { useGamepadNav } from './hooks/useGamepadNav';

type Page = 'dashboard' | 'emulators' | 'library' | 'saves' | 'cloud' | 'settings' | 'controller' | 'utilities';

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
  const [showInstaller, setShowInstaller] = useState(false);

  const { connected, showLegend, dismissLegend } = useGamepadNav(setCurrentPage, currentPage);

  useEffect(() => {
    (async () => {
      const s = await window.omni.settings.get();
      applyTheme(s.theme);
      if (!s.firstSetupComplete) setShowInstaller(true);
    })();
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <ErrorBoundary><Dashboard onNavigate={setCurrentPage} /></ErrorBoundary>;
      case 'emulators':
        return <ErrorBoundary><EmulatorsPage /></ErrorBoundary>;
      case 'library':
        return <ErrorBoundary><LibraryPage /></ErrorBoundary>;
      case 'saves':
        return <ErrorBoundary><SaveManagerPage /></ErrorBoundary>;
      case 'cloud':
        return <ErrorBoundary><CloudSyncPage /></ErrorBoundary>;
      case 'settings':
        return <ErrorBoundary><SettingsPage /></ErrorBoundary>;
      case 'controller':
        return <ErrorBoundary><ControllerPage /></ErrorBoundary>;
      case 'utilities':
        return <ErrorBoundary><UtilitiesPage /></ErrorBoundary>;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <div className="main-content">
        <div className="page-content">
          {renderPage()}
        </div>
      </div>

      {showInstaller && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            width: '90vw', maxWidth: 820, maxHeight: '85vh',
            overflowY: 'auto', borderRadius: 16,
            background: 'var(--bg-primary, #0f0f1a)',
            border: '1px solid var(--border, #333)',
            padding: 32,
          }}>
            <InstallerPage onClose={() => setShowInstaller(false)} />
          </div>
        </div>
      )}

      {connected && showLegend && (
        <div className="controller-legend" onClick={dismissLegend}>
          <span>D-Pad: Navigate</span>
          <span className="sep">|</span>
          <span>A: Select</span>
          <span className="sep">|</span>
          <span>B: Back</span>
          <span className="sep">|</span>
          <span>LB/RB: Switch Tabs</span>
          <span className="sep">|</span>
          <span>Start: Focus Content</span>
        </div>
      )}
    </div>
  );
}
