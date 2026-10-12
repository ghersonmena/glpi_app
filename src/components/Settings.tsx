import React, { useState, useEffect } from 'react';
import type { GLPISession } from '../types/glpi';
import { Server, User, Moon, Sun, LogOut, CheckCircle2 } from 'lucide-react';

interface SettingsProps {
  session: GLPISession;
  onLogout: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ session, onLogout }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
  }, [theme]);

  const envUrl = import.meta.env.VITE_GLPI_URL;
  const envAppToken = import.meta.env.VITE_GLPI_APP_TOKEN;

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '18px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
          Ajustes y Conexión GLPI
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          Información del servidor y preferencia de tema
        </p>
      </div>

      {/* Tarjeta de Sesión Activa */}
      <div className="card">
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <User size={18} color="var(--primary)" /> Perfil Autenticado
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Usuario:</span>
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{session.username}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Perfil Activo:</span>
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{session.activeProfile || 'Estándar'}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Entidad GLPI:</span>
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{session.activeEntity || 'Raíz'}</span>
          </div>
        </div>
      </div>

      {/* Datos del Servidor & Variables de Entorno */}
      <div className="card">
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Server size={18} color="var(--primary)" /> Servidor & Entorno (.env)
        </h3>

        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <strong>URL Servidor:</strong>
            <div style={{ color: 'var(--text-main)', fontFamily: 'monospace', fontSize: '0.8rem', marginTop: '2px', wordBreak: 'break-all' }}>
              {session.baseUrl}
            </div>
          </div>

          <div>
            <strong>Estado de Variables de Entorno:</strong>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              <span className="badge" style={{ background: envUrl ? '#ecfdf5' : '#fef2f2', color: envUrl ? '#059669' : '#dc2626' }}>
                <CheckCircle2 size={12} /> VITE_GLPI_URL
              </span>
              <span className="badge" style={{ background: envAppToken ? '#ecfdf5' : '#fef2f2', color: envAppToken ? '#059669' : '#dc2626' }}>
                <CheckCircle2 size={12} /> VITE_GLPI_APP_TOKEN
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Preferencia de Tema */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {theme === 'dark' ? <Moon size={20} color="#6366f1" /> : <Sun size={20} color="#f59e0b" />}
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Modo Oscuro</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cambiar apariencia visual de la app</div>
            </div>
          </div>

          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-main)',
              color: 'var(--text-main)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            {theme === 'dark' ? 'Activado' : 'Desactivado'}
          </button>
        </div>
      </div>

      {/* Botón de Logout */}
      <button
        onClick={onLogout}
        className="btn-secondary"
        style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', marginTop: '10px' }}
      >
        <LogOut size={18} /> Cerrar Sesión en GLPI
      </button>
    </div>
  );
};
