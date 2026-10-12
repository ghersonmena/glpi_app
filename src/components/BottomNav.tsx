import React from 'react';
import { Ticket, PlusCircle, BarChart3, Settings, FolderKanban } from 'lucide-react';

export type TabType = 'projects' | 'tickets' | 'create' | 'dashboard' | 'settings';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab }) => {
  return (
    <nav className="bottom-nav">
      <button
        className={`nav-item ${activeTab === 'projects' ? 'active' : ''}`}
        onClick={() => onChangeTab('projects')}
      >
        <FolderKanban size={22} />
        <span>Proyectos</span>
      </button>

      <button
        className={`nav-item ${activeTab === 'tickets' ? 'active' : ''}`}
        onClick={() => onChangeTab('tickets')}
      >
        <Ticket size={22} />
        <span>Tickets</span>
      </button>

      <button
        className={`nav-item ${activeTab === 'create' ? 'active' : ''}`}
        onClick={() => onChangeTab('create')}
      >
        <PlusCircle size={22} />
        <span>Nuevo</span>
      </button>

      <button
        className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => onChangeTab('dashboard')}
      >
        <BarChart3 size={22} />
        <span>Métricas</span>
      </button>

      <button
        className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
        onClick={() => onChangeTab('settings')}
      >
        <Settings size={22} />
        <span>Ajustes</span>
      </button>
    </nav>
  );
};
