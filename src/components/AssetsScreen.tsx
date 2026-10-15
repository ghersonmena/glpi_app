import React, { useState, useEffect } from 'react';
import type { GLPISession } from '../types/glpi';
import { AssetService, ASSET_TYPES, getAssetType } from '../services/assetService';
import type { AssetSummary, SavedFilter } from '../services/assetService';
import { AssetFormView } from './AssetFormView';
import type { AssetTab } from './AssetFormView';
import { SavedFiltersModal } from './SavedFiltersModal';
import { FloorPlanView } from './FloorPlanView';
import { Search, RefreshCw, Plus, MapPin, Barcode, Hash, Package, ListFilter, X, Star, User, Map as MapIcon } from 'lucide-react';

interface AssetsScreenProps {
  session: GLPISession;
  // Avisa si hay un formulario abierto (para desactivar el cambio de módulo deslizando)
  onFormOpenChange?: (open: boolean) => void;
}

interface OpenAsset {
  kind?: 'asset';
  itemtype: string;
  id: number | 'new';
  tab?: AssetTab;     // pestaña a mostrar (al regresar a este activo)
  backLabel?: string; // texto del botón de regreso
}

// Croquis abierto: piso/área (null = elegir) y ubicación a resaltar
interface OpenPlan {
  kind: 'plan';
  locationId: number | null;
  focusLocationId?: number | null;
  backLabel: string;
}

type StackEntry = OpenAsset | OpenPlan;

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
  // Pila de activos abiertos: el último es el visible. Al abrir un elemento conectado se apila
  // y "regresar" vuelve al anterior (en la pestaña donde estaba); vacía = listado
  const [stack, setStack] = useState<StackEntry[]>([]);
  const current = stack[stack.length - 1];

  const openAsset = (entry: StackEntry) => setStack(prev => [...prev, entry]);

  useEffect(() => {
    onFormOpenChange?.(stack.length > 0);
  }, [stack.length, onFormOpenChange]);
  // Al salir del módulo, ya no hay formulario abierto
  useEffect(() => () => onFormOpenChange?.(false), [onFormOpenChange]);

  // Cambiar este número vuelve a consultar el listado (botón actualizar, regreso del formulario)
  const [reloadKey, setReloadKey] = useState<number>(0);

  // Búsquedas guardadas de GLPI por tipo y filtro activo por tipo.
  // activeFilters[tipo] === undefined → aún no se decide (se aplica la predeterminada ⭐ al cargar)
  const [filtersByType, setFiltersByType] = useState<Record<string, SavedFilter[]>>({});
  const [filtersError, setFiltersError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Record<string, SavedFilter | null>>({});
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);

  const filtersLoaded = filtersByType[itemtype] !== undefined;
  const filterDecided = itemtype in activeFilters;
  const activeFilter = activeFilters[itemtype] ?? null;

  // 1) Cargar las búsquedas guardadas del tipo y, la primera vez, aplicar la predeterminada (como GLPI)
  useEffect(() => {
    if (filtersLoaded) return;
    let cancelled = false;
    AssetService.getSavedFilters(session, itemtype)
      .then(list => {
        if (cancelled) return;
        setFiltersError(null);
        setFiltersByType(prev => ({ ...prev, [itemtype]: list }));
        setActiveFilters(prev => (itemtype in prev ? prev : { ...prev, [itemtype]: list.find(f => f.isDefault) || null }));
      })
      .catch(err => {
        if (cancelled) return;
        setFiltersError(err.message || 'No se pudieron cargar las búsquedas guardadas.');
        setFiltersByType(prev => ({ ...prev, [itemtype]: [] }));
        setActiveFilters(prev => (itemtype in prev ? prev : { ...prev, [itemtype]: null }));
      });
    return () => { cancelled = true; };
  }, [session, itemtype, filtersLoaded]);

  // 2) Cargar los activos cuando ya se sabe qué filtro aplicar (evita cargar todo y luego filtrar)
  useEffect(() => {
    if (!filterDecided) return;
    let cancelled = false;
    AssetService.listAssets(session, itemtype, activeFilter)
      .then(list => { if (!cancelled) { setAssets(list); setError(null); } })
      .catch(err => { if (!cancelled) { setError(err.message || 'No se pudieron cargar los activos.'); setAssets([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session, itemtype, filterDecided, activeFilter, reloadKey]);

  const applyFilter = (filter: SavedFilter | null) => {
    setFiltersOpen(false);
    if ((filter?.id ?? null) === (activeFilter?.id ?? null)) return;
    setLoading(true);
    setActiveFilters(prev => ({ ...prev, [itemtype]: filter }));
  };

  const load = () => {
    setLoading(true);
    setReloadKey(k => k + 1);
  };

  const config = getAssetType(itemtype);

  const goBack = () => {
    setStack(prev => prev.slice(0, -1));
    if (stack.length === 1) load();
  };

  if (current && current.kind === 'plan') {
    return (
      <FloorPlanView
        key={`${stack.length}-plan-${current.locationId}`}
        session={session}
        locationId={current.locationId}
        focusLocationId={current.focusLocationId}
        backLabel={current.backLabel}
        onBack={goBack}
        onOpenAsset={(linkedType, linkedId, fromName) => openAsset({ itemtype: linkedType, id: linkedId, backLabel: fromName })}
      />
    );
  }

  if (current) {
    return (
      <AssetFormView
        key={`${stack.length}-${current.itemtype}-${current.id}`}
        session={session}
        itemtype={current.itemtype}
        assetId={current.id === 'new' ? null : current.id}
        initialTab={current.tab}
        backLabel={current.backLabel}
        onBack={goBack}
        onSaved={() => { /* el listado se recarga al volver */ }}
        onOpenAsset={(linkedType, linkedId, fromTab, fromName) => {
          // Recordar la pestaña del activo actual para volver a ella
          setStack(prev => [
            ...prev.slice(0, -1),
            { ...(prev[prev.length - 1] as OpenAsset), tab: fromTab },
            { itemtype: linkedType, id: linkedId, backLabel: fromName }
          ]);
        }}
        onOpenPlan={(planLocationId, focusLocationId, fromTab, fromName) => {
          setStack(prev => [
            ...prev.slice(0, -1),
            { ...(prev[prev.length - 1] as OpenAsset), tab: fromTab },
            { kind: 'plan', locationId: planLocationId, focusLocationId, backLabel: fromName }
          ]);
        }}
      />
    );
  }

  // Busca en nombre, etiqueta, serie, inventario, ubicación y usuario asignado. Cada palabra
  // debe aparecer en algún campo, en cualquier orden ("gherson pc" encuentra GhersonMenaPC)
  const words = normalize(search.trim()).split(/\s+/).filter(Boolean);
  const query = words.join(' ');
  const filtered = words.length
    ? assets.filter(a => {
        const haystack = normalize([a.name, a.physicalTag, a.serial, a.inventoryNumber, a.location, a.userName].filter(Boolean).join(' '));
        return words.every(word => haystack.includes(word));
      })
    : assets;

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package color="var(--primary)" size={22} /> Activos
          </h2>
          <button
            type="button"
            onClick={() => openAsset({ kind: 'plan', locationId: null, backLabel: 'Activos' })}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '12px',
              border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--primary)',
              fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', boxShadow: 'var(--shadow-sm)'
            }}
          >
            <MapIcon size={16} /> Croquis
          </button>
        </div>
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
            placeholder="Nombre, etiqueta, serie, inventario, usuario..."
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
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          aria-label="Búsquedas guardadas"
          title="Búsquedas guardadas de GLPI"
          style={{
            position: 'relative', padding: '0 12px', borderRadius: 'var(--radius-md)',
            border: `1px solid ${activeFilter ? 'var(--primary)' : 'var(--border-color)'}`,
            background: activeFilter ? 'rgba(59, 130, 246, 0.12)' : 'var(--card-bg)',
            color: activeFilter ? 'var(--primary)' : 'var(--text-main)', cursor: 'pointer'
          }}
        >
          <ListFilter size={16} />
        </button>
      </div>

      {/* Filtro (búsqueda guardada) activo, con opción de quitarlo */}
      {activeFilter && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', padding: '7px 8px 7px 12px',
            borderRadius: '999px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.35)',
            color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700
          }}
        >
          <ListFilter size={13} style={{ flexShrink: 0 }} />
          {activeFilter.isDefault && <Star size={12} color="#f59e0b" fill="#f59e0b" style={{ flexShrink: 0 }} />}
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeFilter.name}
          </span>
          <button
            type="button"
            onClick={() => applyFilter(null)}
            aria-label="Quitar filtro"
            style={{ display: 'flex', padding: '3px', border: 'none', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary)', cursor: 'pointer' }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {filtersOpen && (
        <SavedFiltersModal
          session={session}
          itemtype={itemtype}
          typeLabel={config.label}
          filters={filtersByType[itemtype] || []}
          loading={!filtersLoaded}
          error={filtersError}
          activeId={activeFilter?.id ?? null}
          onSelect={applyFilter}
          onClose={() => setFiltersOpen(false)}
        />
      )}

      <button
        type="button"
        className="btn-primary"
        onClick={() => openAsset({ itemtype, id: 'new' })}
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
          {query ? 'Sin coincidencias.' : activeFilter ? `Ningún activo cumple “${activeFilter.name}”.` : `No hay ${config.label.toLowerCase()} registrados.`}
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
              onClick={() => openAsset({ itemtype, id: asset.id })}
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
                {asset.userName && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-main)' }}><User size={12} /> {asset.userName}</span>}
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
