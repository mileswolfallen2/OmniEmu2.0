import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { EmulatorsPage } from './pages/EmulatorsPage';
import { LibraryPage } from './pages/LibraryPage';
import { SettingsPage } from './pages/SettingsPage';
import { ControllerPage } from './pages/ControllerPage';
import { useGamepadNav } from './hooks/useGamepadNav';

type Page = 'dashboard' | 'emulators' | 'library' | 'settings' | 'controller';

export function App() {
  useGamepadNav();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

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
    }
  };

  const pageTitle: Record<Page, string> = {
    dashboard: 'Dashboard',
    emulators: 'Emulators',
    library: 'Game Library',
    settings: 'Settings',
    controller: 'Controller',
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
    </div>
  );
}
