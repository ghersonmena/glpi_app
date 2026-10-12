import React, { useState, useEffect } from 'react';
import type { GLPISession, GLPITicket, GLPIFollowup } from '../types/glpi';
import { GLPIService, GLPI_STATUS_MAP, GLPI_PRIORITY_MAP } from '../services/glpiService';
import { ArrowLeft, MessageSquare, Send, User, Tag, ShieldCheck, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface TicketDetailProps {
  session: GLPISession;
  ticket: GLPITicket;
  onBack: () => void;
}

export const TicketDetail: React.FC<TicketDetailProps> = ({ session, ticket, onBack }) => {
  const [followups, setFollowups] = useState<GLPIFollowup[]>([]);
  const [loadingFollowups, setLoadingFollowups] = useState<boolean>(true);
  const [newComment, setNewComment] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchFollowups = async () => {
    setLoadingFollowups(true);
    try {
      const data = await GLPIService.getFollowups(session, ticket.id);
      setFollowups(data);
    } catch (err) {
      console.warn('Error al obtener seguimiento:', err);
    } finally {
      setLoadingFollowups(false);
    }
  };

  useEffect(() => {
    fetchFollowups();
  }, [ticket.id]);

  const handleAddFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const added = await GLPIService.addFollowup(session, ticket.id, newComment.trim());
      setFollowups(prev => [...prev, added]);
      setNewComment('');
      setSuccessMsg('Seguimiento agregado correctamente a GLPI');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al enviar seguimiento');
    } finally {
      setSubmitting(false);
    }
  };

  const statusConfig = GLPI_STATUS_MAP[ticket.status] || { label: 'Estado N/A', color: '#6b7280', bg: '#f3f4f6' };
  const priorityConfig = GLPI_PRIORITY_MAP[ticket.priority] || { label: 'Normal', color: '#3b82f6' };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '20px' }}>
      {/* Botón de volver */}
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          color: 'var(--primary)',
          fontWeight: 700,
          fontSize: '0.85rem',
          cursor: 'pointer',
          marginBottom: '14px'
        }}
      >
        <ArrowLeft size={18} /> Volver a tickets
      </button>

      {/* Tarjeta de Encabezado de Ticket */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)' }}>
            Ticket #{ticket.id}
          </span>
          <span
            className="badge"
            style={{
              backgroundColor: statusConfig.bg,
              color: statusConfig.color
            }}
          >
            <span className="badge-dot" style={{ backgroundColor: statusConfig.color }}></span>
            {statusConfig.label}
          </span>
        </div>

        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '12px', lineHeight: 1.3 }}>
          {ticket.name}
        </h3>

        {/* Metadatos */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem', color: 'var(--text-muted)', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
          <div>
            <strong>Solicitante:</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', color: 'var(--text-main)' }}>
              <User size={14} /> {ticket.user_name || 'No especificado'}
            </div>
          </div>

          <div>
            <strong>Prioridad:</strong>
            <div style={{ color: priorityConfig.color, fontWeight: 700, marginTop: '2px' }}>
              {priorityConfig.label}
            </div>
          </div>

          <div>
            <strong>Categoría:</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', color: 'var(--text-main)' }}>
              <Tag size={14} /> {ticket.category_name || 'General'}
            </div>
          </div>

          <div>
            <strong>Técnico Asignado:</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', color: 'var(--text-main)' }}>
              <ShieldCheck size={14} /> {ticket.assigned_to || 'Sin asignar'}
            </div>
          </div>
        </div>
      </div>

      {/* Descripción del Ticket */}
      <div className="card">
        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
          Descripción del problema
        </h4>
        <div 
          style={{
            fontSize: '0.9rem',
            color: 'var(--text-main)',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            background: 'var(--bg-main)',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)'
          }}
        >
          {ticket.content || 'Sin contenido adicional.'}
        </div>
      </div>

      {/* Timeline de Seguimientos / ITIL Followups */}
      <div style={{ marginTop: '20px' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={18} color="var(--primary)" />
          Seguimientos y Comentarios ({followups.length})
        </h4>

        {loadingFollowups ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
            <Loader2 className="spin" size={20} />
          </div>
        ) : followups.length === 0 ? (
          <div className="card" style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            No hay comentarios registrados para este ticket.
          </div>
        ) : (
          followups.map(item => (
            <div key={item.id} className="card" style={{ padding: '14px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                  {item.user_name || 'Técnico GLPI'}
                </span>
                <span>{new Date(item.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
                {item.content}
              </div>
            </div>
          ))
        )}

        {/* Formulario de agregar seguimiento */}
        {error && (
          <div className="alert-box alert-error">
            <AlertCircle size={16} /> {error}
          </div>
        )}
        {successMsg && (
          <div className="alert-box alert-info">
            <CheckCircle2 size={16} /> {successMsg}
          </div>
        )}

        <form onSubmit={handleAddFollowup} className="card" style={{ marginTop: '14px' }}>
          <label className="form-label">Añadir seguimiento / respuesta</label>
          <textarea
            rows={3}
            className="form-input"
            placeholder="Escribe un comentario o actualización..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={submitting}
            style={{ width: '100%', padding: '10px', resize: 'none' }}
          />

          <button
            type="submit"
            className="btn-primary"
            disabled={submitting || !newComment.trim()}
            style={{ marginTop: '10px', padding: '12px' }}
          >
            {submitting ? (
              <>
                <Loader2 className="spin" size={16} /> Enviando...
              </>
            ) : (
              <>
                <Send size={16} /> Enviar Comentario a GLPI
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
