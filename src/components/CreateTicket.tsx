import React, { useState } from 'react';
import type { GLPISession } from '../types/glpi';
import { GLPIService } from '../services/glpiService';
import { PlusCircle, FileText, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';

interface CreateTicketProps {
  session: GLPISession;
  onTicketCreated: () => void;
  onBack: () => void; // regresar a Tickets sin crear el ticket
}

export const CreateTicket: React.FC<CreateTicketProps> = ({ session, onTicketCreated, onBack }) => {
  const [name, setName] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [urgency, setUrgency] = useState<number>(3); // Media por defecto

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) {
      setError('Por favor completa el título y la descripción del ticket.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await GLPIService.createTicket(session, {
        name: name.trim(),
        content: content.trim(),
        urgency
      });

      setSuccess(true);
      setTimeout(() => {
        onTicketCreated();
      }, 1500);
    } catch (err: any) {
      console.error('Error al crear ticket:', err);
      setError(err.message || 'Ocurrió un error al crear la solicitud en GLPI.');
    } finally {
      setSubmitting(false);
    }
  };

  const urgencyOptions = [
    { level: 1, label: 'Muy Baja', color: '#9ca3af' },
    { level: 2, label: 'Baja', color: '#3b82f6' },
    { level: 3, label: 'Media', color: '#f59e0b' },
    { level: 4, label: 'Alta', color: '#f97316' },
    { level: 5, label: 'Urgente', color: '#ef4444' }
  ];

  // Regresar a Tickets; si ya se escribió algo, confirmar antes de descartarlo
  const handleBack = () => {
    if ((name.trim() || content.trim()) && !success && !window.confirm('Tienes un ticket sin enviar. ¿Salir y descartarlo?')) return;
    onBack();
  };

  return (
    <div className="animate-fade-in">
      <button
        type="button"
        onClick={handleBack}
        disabled={submitting}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '12px', background: 'none', border: 'none',
          color: 'var(--primary)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', padding: 0
        }}
      >
        <ArrowLeft size={18} /> Tickets
      </button>
      <div style={{ marginBottom: '18px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
          Nuevo Ticket de Soporte
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          Registra una incidencia o solicitud directamente en GLPI
        </p>
      </div>

      {success && (
        <div className="alert-box alert-info animate-fade-in">
          <CheckCircle2 size={20} />
          <div>
            <strong>¡Ticket creado con éxito!</strong>
            <div>La solicitud se ha enviado correctamente a GLPI. Redirigiendo...</div>
          </div>
        </div>
      )}

      {error && (
        <div className="alert-box alert-error">
          <AlertCircle size={20} />
          <div>{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card">
        <div className="form-group">
          <label className="form-label">Título de la Solicitud</label>
          <div className="input-wrapper">
            <FileText className="input-icon" size={18} />
            <input
              type="text"
              className="form-input"
              placeholder="Ej. Problema con acceso a correo corporativo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Nivel de Urgencia</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
            {urgencyOptions.map(opt => (
              <button
                key={opt.level}
                type="button"
                onClick={() => setUrgency(opt.level)}
                style={{
                  padding: '8px 4px',
                  borderRadius: 'var(--radius-md)',
                  border: urgency === opt.level ? `2px solid ${opt.color}` : '1px solid var(--border-color)',
                  background: urgency === opt.level ? 'var(--card-bg)' : 'var(--bg-main)',
                  color: urgency === opt.level ? opt.color : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '10px' }}>
          <label className="form-label">Detalle y Descripción</label>
          <textarea
            rows={5}
            className="form-input"
            placeholder="Describe detalladamente el fallo o la solicitud..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={submitting}
            style={{ width: '100%', padding: '12px', resize: 'vertical' }}
          />
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={submitting || success}
          style={{ marginTop: '14px' }}
        >
          {submitting ? (
            <>
              <Loader2 className="spin" size={20} /> Guardando en GLPI...
            </>
          ) : (
            <>
              <PlusCircle size={20} /> Crear Solicitud en GLPI
            </>
          )}
        </button>
      </form>
    </div>
  );
};
