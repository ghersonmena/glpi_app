import React, { useState, useEffect } from 'react';
import type { GLPISession, GLPITicket, GLPIProject } from './types/glpi';
import { GLPIService } from './services/glpiService';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import type { TabType } from './components/BottomNav';
import { Login } from './components/Login';
import { TicketList } from './components/TicketList';
import { TicketDetail } from './components/TicketDetail';
import { CreateTicket } from './components/CreateTicket';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';
import { ProjectList } from './components/ProjectList';
import { ProjectTaskTree } from './components/ProjectTaskTree';

export const App: React.FC = () => {
  const [session, setSession] = useState<GLPISession | null>(() => {
    const saved = sessionStorage.getItem('glpi_session');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState<TabType>('projects');
  const [selectedTicket, setSelectedTicket] = useState<GLPITicket | null>(null);
  const [selectedProject, setSelectedProject] = useState<GLPIProject | null>(null);

  // Guardar sesión en sessionStorage
  useEffect(() => {
    if (session) {
      sessionStorage.setItem('glpi_session', JSON.stringify(session));
    } else {
      sessionStorage.removeItem('glpi_session');
    }
  }, [session]);

  const handleLoginSuccess = (newSession: GLPISession) => {
    setSession(newSession);
    setActiveTab('projects');
    setSelectedTicket(null);
    setSelectedProject(null);
  };

  const handleLogout = async () => {
    if (session) {
      try {
        await GLPIService.killSession(session);
      } catch (e) {
        console.warn(e);
      }
    }
    setSession(null);
    setSelectedTicket(null);
    setSelectedProject(null);
  };

  const getHeaderTitle = (): string | undefined => {
    if (selectedProject) return `Proyecto #${selectedProject.id}`;
    if (selectedTicket) return `Ticket #${selectedTicket.id}`;
    return undefined;
  };

  return (
    <div className="mobile-app-wrapper">
      <Header
        session={session}
        onLogout={handleLogout}
        title={getHeaderTitle()}
      />

      <main className="app-content">
        {!session ? (
          <Login onLoginSuccess={handleLoginSuccess} />
        ) : selectedProject ? (
          <ProjectTaskTree
            session={session}
            project={selectedProject}
            onBack={() => setSelectedProject(null)}
          />
        ) : selectedTicket ? (
          <TicketDetail
            session={session}
            ticket={selectedTicket}
            onBack={() => setSelectedTicket(null)}
          />
        ) : (
          <>
            {activeTab === 'projects' && (
              <ProjectList
                session={session}
                onSelectProject={(prj) => setSelectedProject(prj)}
              />
            )}

            {activeTab === 'tickets' && (
              <TicketList
                session={session}
                onSelectTicket={(ticket) => setSelectedTicket(ticket)}
                onCreateNew={() => setActiveTab('create')}
              />
            )}

            {activeTab === 'create' && (
              <CreateTicket
                session={session}
                onTicketCreated={() => setActiveTab('tickets')}
              />
            )}

            {activeTab === 'dashboard' && (
              <Dashboard
                session={session}
                onNavigateTab={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'settings' && (
              <Settings
                session={session}
                onLogout={handleLogout}
              />
            )}
          </>
        )}
      </main>

      {session && !selectedTicket && !selectedProject && (
        <BottomNav
          activeTab={activeTab}
          onChangeTab={(tab) => {
            setSelectedTicket(null);
            setSelectedProject(null);
            setActiveTab(tab);
          }}
        />
      )}
    </div>
  );
};

export default App;
