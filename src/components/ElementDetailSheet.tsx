import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { GLPISession, LinkedElement, ElementDetails } from '../types/glpi';
import { GLPIService } from '../services/glpiService';
import { RefreshCw, X, Monitor, Tag, MapPin, Box, Hash, User } from 'lucide-react';

interface ElementDetailSheetProps {
  session: GLPISession;
  elements: LinkedElement[];
  contextName: string; // nombre de la tarea o proyecto al que pertenece
  onClose: () => void;
}

const ITEMTYPE_LABELS: Record<string, string> = {
  Computer: 'Computadora',
  Monitor: 'Monitor',
  Printer: 'Impresora',
  Phone: 'Teléfono',
  Peripheral: 'Dispositivo',
  NetworkEquipment: 'Equipo de red'
};

const DetailRow: React.FC<{ icon: React.ReactNode; label: string; value?: string }> = ({ icon, label, value }) => (
  <div style={{ display: 'flex', gap: '10px', padding: '10px 0', borderTop: '1px solid var(--border-color)' }}>
    <span style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </div>
      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: value ? 'var(--text-main)' : 'var(--text-muted)', wordBreak: 'break-word', marginTop: '2px' }}>
        {value || 'Sin capturar'}
      </div>
    </div>
  </div>
);

// Ventana flotante (centrada) con los datos de los elementos relacionados.
// Solo se cierra con la X, para no perderla con un toque accidental fuera de ella.
export const ElementDetailSheet: React.FC<ElementDetailSheetProps> = ({ session, elements, contextName, onClose }) => {
  const [details, setDetails] = useState<ElementDetails[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(elements.map(el => GLPIService.getElementDetails(session, el)))
      .then(list => { if (!cancelled) setDetails(list); })
      .catch(err => { if (!cancelled) setError(err.message || 'No se pudo consultar el elemento.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session, elements]);

  // Portal a <body>: el árbol está en un contenedor con transform que recortaría el fixed
  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px calc(16px + env(safe-area-inset-bottom, 0px))',
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)'
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="modal-pop"
        style={{
          width: '100%', maxWidth: '420px', maxHeight: '100%', overflowY: 'auto',
          background: 'var(--card-bg)', borderRadius: '24px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 24px 60px -12px rgba(0, 0, 0, 0.45)', padding: '18px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {elements.length === 1 ? 'Elemento relacionado' : `Elementos relacionados (${elements.length})`}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{contextName}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{ background: 'var(--bg-main)', border: 'none', borderRadius: '50%', padding: '6px', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '16px 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <RefreshCw size={14} className="spin" /> Consultando inventario de GLPI...
          </div>
        ) : error ? (
          <div style={{ padding: '12px 0', fontSize: '0.8rem', fontWeight: 600, color: '#dc2626' }}>{error}</div>
        ) : (
          details.map(detail => (
            <div
              key={`${detail.itemtype}#${detail.id}`}
              style={{ marginTop: '10px', padding: '4px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '18px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 0 6px', fontSize: '0.72rem', fontWeight: 800, color: '#8b5cf6' }}>
                {detail.itemtype === 'Computer' ? <Monitor size={14} /> : <Box size={14} />}
                {ITEMTYPE_LABELS[detail.itemtype] || detail.itemtype}
              </div>
              <DetailRow icon={<Box size={16} />} label="Nombre del equipo" value={detail.name} />
              <DetailRow icon={<User size={16} />} label="Usuario" value={detail.userName} />
              {detail.itemtype === 'Computer' && (
                <DetailRow icon={<Tag size={16} />} label="Etiqueta física" value={detail.physicalTag} />
              )}
              <DetailRow icon={<Hash size={16} />} label="Número de serie" value={detail.serial} />
              <DetailRow icon={<MapPin size={16} />} label="Ubicación" value={detail.location} />
            </div>
          ))
        )}
      </div>
    </div>,
    document.body
  );
};
