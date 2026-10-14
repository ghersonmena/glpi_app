import React, { useState, useEffect } from 'react';
import type { GLPISession } from '../types/glpi';
import { AssetService, ASSET_TYPES, getAssetType } from '../services/assetService';
import type { AssetSummary } from '../services/assetService';
import { AssetFormView } from './AssetFormView';
import { Search, RefreshCw, Plus, MapPin, Barcode, Hash, Package } from 'lucide-react';

interface AssetsScreenProps {
  session: GLPISession;
  // Avisa si hay un formulario abierto (para desactivar el cambio de módulo deslizando)
  onFormOpenChange?: (open: boolean) => void;
}

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Último tramo de una ruta de ubicación ("Oficinas > Planta Baja > Sistemas" → "Sistemas")
const shortLocation = (path?: string) => (path ? path.split('>').slice(-2).map(s => s.trim()).join(' › ') : '');

// Módulo de Activos: listado por tipo con búsqueda, alta y edición
export const AssetsScreen: React.FC<AssetsScreenProps> = ({ session, onFormOpenChange }) => {
  const [itemtype, setItemtype] = useState<string>(ASSET_TYPES[0].itemtype);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  // Activo abierto en el formulario: número = edición, 'new' = alta, null = listado
  const [editing, setEditing] = useState<number | 'new' | null>(null);

  useEffect(() => {
    onFormOpenChange?.(editing !== null);
  }, [editing, onFormOpenChange]);
  // Al salir del módulo, ya no hay formulario abierto
  useEffect(() => () => onFormOpenChange?.(false), [onFormOpenChange]);

  // Cambiar este número vuelve a consultar el listado (botón actualizar, regreso del formulario)
  const [reloadKey, setReloadKey] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    AssetService.listAssets(session, itemtype)
      .then(list => { if (!cancelled) { setAssets(list); setError(null); } })
      .catch(err => { if (!cancelled) { setError(err.message || 'No se pudieron cargar los activos.'); setAssets([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session, itemtype, reloadKey]);

  const load = () => {
    setLoading(true);
    setReloadKey(k => k + 1);
  };

  const config = getAssetType(itemtype);

  if (editing !== null) {
    return (
      <AssetFormView
        key={`${itemtype}-${editing}`}
        session={session}
        itemtype={itemtype}
        assetId={editing === 'new' ? null : editing}
        onBack={() => { setEditing(null); load(); }}
        onSaved={() => { /* el listado se recarga al volver */ }}
      />
    );
  }

  // Busca en nombre, etiqueta, serie, inventario y ubicación
  const query = normalize(search.trim());
  const filtered = query
    ? assets.filter(a => normalize([a.name, a.physicalTag, a.serial, a.inventoryNumber, a.location].filter(Boolean).join(' ')).includes(query))
    : assets;

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '14px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Package color="var(--primary)" size={22} /> Activos
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          Registra y actualiza el inventario de GLPI
        </p>
      </div>

      {/* Selector de tipo de activo */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '10px', scrollbarWidth: 'none' }}>
        {ASSET_TYPES.map(t => {
          const active = t.itemtype === itemtype;
          return (
            <button
              key={t.itemtype}
              type="button"
              onClick={() => {
                if (t.itemtype === itemtype) return;
                setLoading(true);
                setItemtype(t.itemtype);
                setSearch('');
              }}
              style={{
                flex: '0 0 auto', padding: '7px 12px', borderRadius: '999px',
                border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border-color)'}`,
                background: active ? 'rgba(59, 130, 246, 0.12)' : 'var(--card-bg)',
                color: active ? 'var(--primary)' : 'var(--text-main)',
                fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap'
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Búsqueda + alta */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <div className="input-wrapper" style={{ flex: 1 }}>
          <Search className="input-icon" size={18} />
          <input
            className="form-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nombre, etiqueta, serie, inventario..."
          />
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          aria-label="Actualizar"
          style={{
            padding: '0 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
            background: 'var(--card-bg)', color: 'var(--text-main)', cursor: 'pointer'
          }}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
        </button>
      </div>

      <button
        type="button"
        className="btn-primary"
        onClick={() => setEditing('new')}
        style={{ marginBottom: '14px' }}
      >
        <Plus size={18} /> Nuevo {config.singular.toLowerCase()}
      </button>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
          <RefreshCw className="spin" size={24} style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '0.85rem' }}>Cargando {config.label.toLowerCase()}...</div>
        </div>
      ) : error ? (
        <div className="card" style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: 600 }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {query ? 'Sin coincidencias.' : `No hay ${config.label.toLowerCase()} registrados.`}
        </div>
      ) : (
        <>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', padding: '0 4px' }}>
            {filtered.length} {filtered.length === 1 ? config.singular.toLowerCase() : config.label.toLowerCase()}
          </div>
          {filtered.map(asset => (
            <div
              key={asset.id}
              className="card card-interactive"
              onClick={() => setEditing(asset.id)}
              style={{ padding: '12px 14px', marginBottom: '8px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', minWidth: 0, wordBreak: 'break-word' }}>
                  {asset.name}
                </div>
                {asset.state && (
                  <span className="badge" style={{ background: 'var(--bg-main)', color: 'var(--text-muted)', fontSize: '0.68rem', flexShrink: 0 }}>
                    {asset.state.split('>').pop()?.trim()}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: '6px', fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {asset.physicalTag && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#8b5cf6' }}><Barcode size={12} /> {asset.physicalTag}</span>}
                {asset.serial && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Hash size={12} /> {asset.serial}</span>}
                {asset.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> {shortLocation(asset.location)}</span>}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};
