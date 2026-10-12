import React from 'react';
import type { GLPISession } from '../types/glpi';
import { LogOut, ShieldCheck, Sparkles } from 'lucide-react';

interface HeaderProps {
  session: GLPISession | null;
  onLogout: () => void;
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ session, onLogout, title }) => {
  return (
    <header className="app-header">
      <div className="brand-badge">
        <div className="brand-logo">
          GL
        </div>
        <div>
          <div className="brand-title">{title || 'GLPI Mobile'}</div>
          {session && (
            <div className="brand-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={12} color="#10b981" />
              {session.activeProfile || 'Usuario'}
            </div>
          )}
        </div>
      </div>

      {session && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {session.isMock && (
            <span 
              className="badge" 
              style={{ backgroundColor: '#fef3c7', color: '#b45309', fontSize: '0.68rem', padding: '3px 8px' }}
              title="Modo Demostración Activado"
            >
              <Sparkles size={10} /> MOCK DEMO
            </span>
          )}
          <button
            onClick={onLogout}
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: 'none',
              color: '#ef4444',
              padding: '8px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Cerrar Sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
      )}
    </header>
  );
};
