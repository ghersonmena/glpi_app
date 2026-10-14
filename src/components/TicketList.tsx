import React, { useState, useEffect } from 'react';
import type { GLPISession, GLPITicket } from '../types/glpi';
import { GLPIService, GLPI_STATUS_MAP, GLPI_PRIORITY_MAP } from '../services/glpiService';
import { Search, RefreshCw, Calendar, Tag, AlertCircle, ChevronRight, Inbox, Plus } from 'lucide-react';

interface TicketListProps {
  session: GLPISession;
  onSelectTicket: (ticket: GLPITicket) => void;
  onCreateNew: () => void;
}

export const TicketList: React.FC<TicketListProps> = ({ session, onSelectTicket, onCreateNew }) => {
  const [tickets, setTickets] = useState<GLPITicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<number | 'all'>('all');

  const fetchTickets = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await GLPIService.getTickets(session);
      setTickets(data);
    } catch (err: any) {
      console.error('Error fetching tickets:', err);
      setError(err.message || 'No se pudieron cargar los tickets de GLPI.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [session]);

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.id.toString().includes(searchQuery) ||
      (ticket.category_name && ticket.category_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return dateStr;
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Buscador & Botón de actualización */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
        <div className="input-wrapper" style={{ flex: 1 }}>
          <Search className="input-icon" size={18} />
          <input
            type="text"
            className="form-input"
            placeholder="Buscar por ID, título o categoría..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '10px 14px 10px 40px', fontSize: '0.85rem' }}
          />
        </div>

        <button
          onClick={() => fetchTickets(true)}
          disabled={refreshing || loading}
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '0 14px',
            color: 'var(--text-main)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-sm)'
          }}
          title="Actualizar tickets"
        >
          <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
        </button>

        {/* Alta de ticket: antes era una pestaña propia ("Nuevo"), ahora ocupada por Activos */}
        <button
          onClick={onCreateNew}
          style={{
            background: 'var(--primary-gradient)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: '0 14px',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            fontWeight: 700,
            fontSize: '0.8rem',
            boxShadow: 'var(--shadow-sm)'
          }}
          title="Crear ticket nuevo"
        >
          <Plus size={18} /> Nuevo
        </button>
      </div>

      {/* Filtros rápidos por estado */}
      <div 
        style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '8px',
          marginBottom: '14px',
          scrollbarWidth: 'none'
        }}
      >
        <button
          onClick={() => setStatusFilter('all')}
          className="badge"
          style={{
            background: statusFilter === 'all' ? 'var(--primary)' : 'var(--card-bg)',
            color: statusFilter === 'all' ? '#ffffff' : 'var(--text-muted)',
            border: '1px solid var(--border-color)',
            cursor: 'pointer',
            padding: '6px 12px'
          }}
        >
          Todos ({tickets.length})
        </button>
        <button
          onClick={() => setStatusFilter(1)}
          className="badge"
          style={{
            background: statusFilter === 1 ? '#ef4444' : 'var(--card-bg)',
            color: statusFilter === 1 ? '#ffffff' : 'var(--text-muted)',
            border: '1px solid var(--border-color)',
            cursor: 'pointer',
            padding: '6px 12px'
          }}
        >
          Nuevos ({tickets.filter(t => t.status === 1).length})
        </button>
        <button
          onClick={() => setStatusFilter(2)}
          className="badge"
          style={{
            background: statusFilter === 2 ? '#f59e0b' : 'var(--card-bg)',
            color: statusFilter === 2 ? '#ffffff' : 'var(--text-muted)',
            border: '1px solid var(--border-color)',
            cursor: 'pointer',
            padding: '6px 12px'
          }}
        >
          En Curso ({tickets.filter(t => t.status === 2 || t.status === 3).length})
        </button>
        <button
          onClick={() => setStatusFilter(5)}
          className="badge"
          style={{
            background: statusFilter === 5 ? '#10b981' : 'var(--card-bg)',
            color: statusFilter === 5 ? '#ffffff' : 'var(--text-muted)',
            border: '1px solid var(--border-color)',
            cursor: 'pointer',
            padding: '6px 12px'
          }}
        >
          Resueltos ({tickets.filter(t => t.status === 5).length})
        </button>
      </div>

      {error && (
        <div className="alert-box alert-error">
          <AlertCircle size={18} />
          <div>{error}</div>
        </div>
      )}

      {/* Listado de tickets */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          <RefreshCw className="spin" size={28} style={{ marginBottom: '10px' }} />
          <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Cargando tickets de GLPI...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div 
          className="card" 
          style={{ textAlign: 'center', padding: '40px 20px', marginTop: '10px' }}
        >
          <Inbox size={48} color="var(--text-muted)" style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>No se encontraron tickets</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {searchQuery ? 'Prueba con otro término de búsqueda.' : 'No hay solicitudes activas en este filtro.'}
          </p>
          <button
            onClick={onCreateNew}
            className="btn-primary"
            style={{ width: 'auto', margin: '16px auto 0 auto', padding: '10px 18px', fontSize: '0.85rem' }}
          >
            <Plus size={16} /> Crear Ticket Nuevo
          </button>
        </div>
      ) : (
        <div>
          {filteredTickets.map(ticket => {
            const statusConfig = GLPI_STATUS_MAP[ticket.status] || { label: 'Desconocido', color: '#6b7280', bg: '#f3f4f6' };
            const priorityConfig = GLPI_PRIORITY_MAP[ticket.priority] || { label: 'Normal', color: '#3b82f6' };

            return (
              <div
                key={ticket.id}
                className="card card-interactive animate-fade-in"
                onClick={() => onSelectTicket(ticket)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                      #{ticket.id}
                    </span>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: statusConfig.bg,
                        color: statusConfig.color,
                        fontSize: '0.72rem',
                        padding: '3px 8px'
                      }}
                    >
                      <span className="badge-dot" style={{ backgroundColor: statusConfig.color }}></span>
                      {statusConfig.label}
                    </span>
                  </div>

                  <span 
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: priorityConfig.color
                    }}
                  >
                    Prioridad: {priorityConfig.label}
                  </span>
                </div>

                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px', lineHeight: 1.3 }}>
                  {ticket.name}
                </h4>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {ticket.category_name && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Tag size={12} /> {ticket.category_name}
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> {formatDate(ticket.date)}
                    </span>
                  </div>

                  <ChevronRight size={18} color="var(--text-muted)" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
