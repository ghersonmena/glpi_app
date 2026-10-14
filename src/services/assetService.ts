import type { GLPISession } from '../types/glpi';
import { GLPIService, PHYSICAL_TAG_FIELD } from './glpiService';
import { savedQueryToSearchParams } from './savedSearchQuery';

// Tipos de activo que maneja el módulo de Activos y los campos propios de cada uno en GLPI
export interface AssetTypeConfig {
  itemtype: string;
  label: string;       // plural, para el selector
  singular: string;
  typeField: string;   // campo FK del tipo (p. ej. computertypes_id)
  typeItemtype: string;
  modelField: string;  // campo FK del modelo
  modelItemtype: string;
  stateVisibility: string; // columna de State que indica si el estado aplica a este tipo
}

export const ASSET_TYPES: AssetTypeConfig[] = [
  { itemtype: 'Computer', label: 'Computadoras', singular: 'Computadora', typeField: 'computertypes_id', typeItemtype: 'ComputerType', modelField: 'computermodels_id', modelItemtype: 'ComputerModel', stateVisibility: 'is_visible_computer' },
  { itemtype: 'Monitor', label: 'Monitores', singular: 'Monitor', typeField: 'monitortypes_id', typeItemtype: 'MonitorType', modelField: 'monitormodels_id', modelItemtype: 'MonitorModel', stateVisibility: 'is_visible_monitor' },
  { itemtype: 'Phone', label: 'Teléfonos', singular: 'Teléfono', typeField: 'phonetypes_id', typeItemtype: 'PhoneType', modelField: 'phonemodels_id', modelItemtype: 'PhoneModel', stateVisibility: 'is_visible_phone' },
  { itemtype: 'Peripheral', label: 'Dispositivos', singular: 'Dispositivo', typeField: 'peripheraltypes_id', typeItemtype: 'PeripheralType', modelField: 'peripheralmodels_id', modelItemtype: 'PeripheralModel', stateVisibility: 'is_visible_peripheral' },
  { itemtype: 'Printer', label: 'Impresoras', singular: 'Impresora', typeField: 'printertypes_id', typeItemtype: 'PrinterType', modelField: 'printermodels_id', modelItemtype: 'PrinterModel', stateVisibility: 'is_visible_printer' },
  { itemtype: 'NetworkEquipment', label: 'Equipos de red', singular: 'Equipo de red', typeField: 'networkequipmenttypes_id', typeItemtype: 'NetworkEquipmentType', modelField: 'networkequipmentmodels_id', modelItemtype: 'NetworkEquipmentModel', stateVisibility: 'is_visible_networkequipment' }
];

export const getAssetType = (itemtype: string): AssetTypeConfig =>
  ASSET_TYPES.find(t => t.itemtype === itemtype) || ASSET_TYPES[0];

// Fila del listado de activos
export interface AssetSummary {
  id: number;
  name: string;
  serial?: string;
  inventoryNumber?: string;
  physicalTag?: string;
  location?: string;
  state?: string;
}

// Datos editables de un activo (FKs como IDs; 0 = sin valor)
export interface AssetForm {
  name: string;
  states_id: number;
  typeId: number;
  manufacturers_id: number;
  modelId: number;
  locations_id: number;
  users_id: number;
  serial: string;
  otherserial: string; // número de inventario
  uuid: string;
  physicalTag: string; // solo si el tipo tiene el campo del plugin
  comment: string;
}

export const emptyAssetForm = (): AssetForm => ({
  name: '', states_id: 0, typeId: 0, manufacturers_id: 0, modelId: 0, locations_id: 0,
  users_id: 0, serial: '', otherserial: '', uuid: '', physicalTag: '', comment: ''
});

// Búsqueda guardada de GLPI ("filtro") para un tipo de activo
export interface SavedFilter {
  id: number;
  name: string;
  query: string;       // consulta tal como la guarda GLPI
  isPrivate: boolean;  // solo visible para quien la creó
  isDefault: boolean;  // la predeterminada (⭐) del usuario para este tipo
}

export interface DropdownOption {
  id: number;
  label: string;
}

// Opciones de búsqueda estándar de GLPI para activos
const SO = { name: '1', id: '2', location: '3', serial: '5', inventory: '6', state: '31' };

const authHeaders = (session: GLPISession) => ({
  'Content-Type': 'application/json',
  'App-Token': session.appToken,
  'Session-Token': session.sessionToken
});

const readError = async (res: Response): Promise<string> => {
  try {
    const err = await res.json();
    if (Array.isArray(err) && err[1]) return `: ${err[1]}`;
  } catch { /* respuesta sin JSON */ }
  return '';
};

// ── Datos de ejemplo (modo demo) ────────────────────────────────────────────
let mockSeq = 1000;
const MOCK_ASSETS: Record<string, (AssetForm & { id: number })[]> = {
  Computer: [
    { ...emptyAssetForm(), id: 89, name: 'GhersonMenaPC', serial: 'MXL1234ABC', otherserial: 'INV-0103', physicalTag: 'PC-000103', locations_id: 1, states_id: 1, users_id: 2 }
  ],
  Monitor: [{ ...emptyAssetForm(), id: 12, name: 'MON-SIS-01', serial: 'CN0ABC123', locations_id: 1, states_id: 1 }]
};
const MOCK_DROPDOWNS: Record<string, DropdownOption[]> = {
  Location: [{ id: 1, label: 'Oficinas ACERO > Planta Baja > Sistemas > 8 Posicion' }],
  State: [{ id: 1, label: 'En uso' }, { id: 2, label: 'En almacén' }],
  Manufacturer: [{ id: 1, label: 'Dell' }, { id: 2, label: 'HP' }, { id: 3, label: 'Lenovo' }]
};

const MOCK_FILTERS: (SavedFilter & { itemtype: string })[] = [
  { id: 1, itemtype: 'Computer', name: 'EQUIPOS EN USO', query: 'criteria[0][field]=31&criteria[0][searchtype]=equals&criteria[0][value]=1', isPrivate: false, isDefault: true },
  { id: 2, itemtype: 'Computer', name: 'EQUIPOS EN ALMACÉN', query: 'criteria[0][field]=31&criteria[0][searchtype]=equals&criteria[0][value]=2', isPrivate: true, isDefault: false }
];

export class AssetService {
  private static dropdownCache = new Map<string, Promise<DropdownOption[]>>();

  /** ¿Este tipo de activo tiene el campo "Etiqueta Física" del plugin Campos adicionales? */
  static async supportsPhysicalTag(session: GLPISession, itemtype: string): Promise<boolean> {
    if (session.isMock) return itemtype === 'Computer';
    return (await GLPIService.getPhysicalTagOption(session, itemtype).catch(() => null)) !== null;
  }

  /**
   * Búsquedas guardadas de GLPI para un tipo de activo. GLPI devuelve las del usuario de la
   * sesión (incluidas sus privadas) más las públicas de otros, así que cada usuario ve las suyas.
   */
  static async getSavedFilters(session: GLPISession, itemtype: string): Promise<SavedFilter[]> {
    if (session.isMock) return MOCK_FILTERS.filter(f => f.itemtype === itemtype);

    const [searches, defaults] = await Promise.all([
      GLPIService.fetchAllPages(session, 'SavedSearch'),
      // Predeterminada por usuario y tipo (la ⭐ en GLPI); si falla, simplemente no hay ⭐
      GLPIService.fetchAllPages(session, 'SavedSearch_User').catch(() => [])
    ]);
    const defaultIds = new Set(
      defaults
        .filter((d: any) => d.itemtype === itemtype && Number(d.users_id) === Number(session.userId))
        .map((d: any) => Number(d.savedsearches_id))
    );
    return searches
      .filter((s: any) => s.itemtype === itemtype && Number(s.type) === 1) // type 1 = búsqueda
      .map((s: any) => ({
        id: Number(s.id),
        name: String(s.name || `Búsqueda #${s.id}`),
        query: String(s.query || ''),
        isPrivate: Number(s.is_private) === 1,
        isDefault: defaultIds.has(Number(s.id))
      }))
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name, 'es'));
  }

  /** Cuántos activos devuelve una búsqueda guardada (el número que GLPI muestra junto a cada una). */
  static async countSavedFilter(session: GLPISession, itemtype: string, filter: SavedFilter): Promise<number> {
    if (session.isMock) return (await this.listAssets(session, itemtype, filter)).length;
    const params = savedQueryToSearchParams(filter.query);
    params.set('range', '0-0');
    params.append('forcedisplay[0]', SO.id);
    const res = await fetch(`${session.baseUrl}/apirest.php/search/${itemtype}?${params}`, { headers: authHeaders(session) });
    if (!res.ok) throw new Error(`La búsqueda "${filter.name}" no se pudo ejecutar (${res.status})${await readError(res)}`);
    return Number((await res.json())?.totalcount) || 0;
  }

  /**
   * Activos de un tipo (excluye papelera y plantillas), ordenados por nombre. Con `filter`, solo
   * los que cumplen esa búsqueda guardada de GLPI.
   */
  static async listAssets(session: GLPISession, itemtype: string, filter?: SavedFilter | null): Promise<AssetSummary[]> {
    if (session.isMock) {
      const locations = MOCK_DROPDOWNS.Location;
      return (MOCK_ASSETS[itemtype] || []).filter(a => !filter || a.states_id === Number(new URLSearchParams(filter.query).get('criteria[0][value]'))).map(a => ({
        id: a.id, name: a.name, serial: a.serial, inventoryNumber: a.otherserial, physicalTag: a.physicalTag,
        location: locations.find(l => l.id === a.locations_id)?.label,
        state: MOCK_DROPDOWNS.State.find(s => s.id === a.states_id)?.label
      }));
    }

    const tagOption = await GLPIService.getPhysicalTagOption(session, itemtype).catch(() => null);
    const display = [SO.name, SO.id, SO.location, SO.serial, SO.inventory, SO.state, ...(tagOption ? [tagOption] : [])];
    const result: AssetSummary[] = [];
    const pageSize = 50; // GLPI recorta cada respuesta a list_limit_max (50 por defecto)

    for (let start = 0; start < 20000; start += pageSize) {
      // Criterios de la búsqueda guardada (si hay) + columnas, orden y página de la app
      const params = filter ? savedQueryToSearchParams(filter.query) : new URLSearchParams();
      params.set('sort', SO.name);
      params.set('order', 'ASC');
      params.set('range', `${start}-${start + pageSize - 1}`);
      display.forEach((opt, i) => params.set(`forcedisplay[${i}]`, opt));
      const res = await fetch(`${session.baseUrl}/apirest.php/search/${itemtype}?${params}`, { headers: authHeaders(session) });
      if (!res.ok) {
        if (start === 0) {
          throw new Error(filter
            ? `La búsqueda "${filter.name}" no se pudo ejecutar (${res.status})${await readError(res)}`
            : `No se pudieron cargar los activos (${res.status})${await readError(res)}`);
        }
        break;
      }
      const body = await res.json();
      const rows: any[] = Array.isArray(body?.data) ? body.data : [];
      rows.forEach(row => result.push({
        id: Number(row[SO.id]),
        name: row[SO.name] || `${getAssetType(itemtype).singular} #${row[SO.id]}`,
        serial: row[SO.serial] || undefined,
        inventoryNumber: row[SO.inventory] || undefined,
        physicalTag: tagOption ? row[tagOption] || undefined : undefined,
        location: row[SO.location] || undefined,
        state: row[SO.state] || undefined
      }));
      const total = Number(body?.totalcount) || 0;
      if (rows.length === 0 || result.length >= total) break;
    }
    return result;
  }

  /** Datos editables de un activo. */
  static async getAsset(session: GLPISession, itemtype: string, id: number): Promise<AssetForm> {
    const config = getAssetType(itemtype);
    if (session.isMock) {
      const found = (MOCK_ASSETS[itemtype] || []).find(a => a.id === id);
      if (!found) throw new Error('Activo no encontrado');
      return { ...found };
    }

    const tagOption = await GLPIService.getPhysicalTagOption(session, itemtype).catch(() => null);
    const [itemRes, tagRes] = await Promise.all([
      fetch(`${session.baseUrl}/apirest.php/${itemtype}/${id}`, { headers: authHeaders(session) }),
      tagOption
        ? fetch(`${session.baseUrl}/apirest.php/search/${itemtype}?criteria[0][field]=${SO.id}&criteria[0][searchtype]=equals&criteria[0][value]=${id}&forcedisplay[0]=${tagOption}`, { headers: authHeaders(session) })
        : Promise.resolve(null)
    ]);
    if (!itemRes.ok) throw new Error(`No se pudo cargar el activo (${itemRes.status})${await readError(itemRes)}`);
    const item = await itemRes.json();
    const tagRow = tagRes && tagRes.ok ? (await tagRes.json())?.data?.[0] : null;

    return {
      name: item.name || '',
      states_id: Number(item.states_id) || 0,
      typeId: Number(item[config.typeField]) || 0,
      manufacturers_id: Number(item.manufacturers_id) || 0,
      modelId: Number(item[config.modelField]) || 0,
      locations_id: Number(item.locations_id) || 0,
      users_id: Number(item.users_id) || 0,
      serial: item.serial || '',
      otherserial: item.otherserial || '',
      uuid: item.uuid || '',
      physicalTag: (tagOption && tagRow?.[tagOption]) || '',
      comment: item.comment || ''
    };
  }

  private static toInput(itemtype: string, form: AssetForm, withPhysicalTag: boolean): Record<string, unknown> {
    const config = getAssetType(itemtype);
    const input: Record<string, unknown> = {
      name: form.name.trim(),
      states_id: form.states_id,
      [config.typeField]: form.typeId,
      manufacturers_id: form.manufacturers_id,
      [config.modelField]: form.modelId,
      locations_id: form.locations_id,
      users_id: form.users_id,
      serial: form.serial.trim(),
      otherserial: form.otherserial.trim(),
      uuid: form.uuid.trim(),
      comment: form.comment
    };
    // El plugin Campos adicionales guarda su campo si viene junto con los datos del activo
    if (withPhysicalTag) input[PHYSICAL_TAG_FIELD] = form.physicalTag.trim();
    return input;
  }

  /** Crea un activo y devuelve su ID. */
  static async createAsset(session: GLPISession, itemtype: string, form: AssetForm, withPhysicalTag: boolean): Promise<number> {
    if (session.isMock) {
      const id = ++mockSeq;
      (MOCK_ASSETS[itemtype] ||= []).push({ ...form, id });
      return id;
    }
    const res = await fetch(`${session.baseUrl}/apirest.php/${itemtype}`, {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify({ input: this.toInput(itemtype, form, withPhysicalTag) })
    });
    if (!res.ok) throw new Error(`No se pudo crear el activo (${res.status})${await readError(res)}`);
    const created = await res.json();
    const id = Number(created?.id);
    if (!id) throw new Error(`GLPI no creó el activo${created?.message ? `: ${created.message}` : ''}`);
    return id;
  }

  /** Guarda los cambios de un activo existente. */
  static async updateAsset(session: GLPISession, itemtype: string, id: number, form: AssetForm, withPhysicalTag: boolean): Promise<void> {
    if (session.isMock) {
      const list = MOCK_ASSETS[itemtype] || [];
      const index = list.findIndex(a => a.id === id);
      if (index >= 0) list[index] = { ...form, id };
      return;
    }
    await GLPIService.putItem(session, itemtype, id, this.toInput(itemtype, form, withPhysicalTag), 'el activo');
  }

  /** Opciones de un desplegable de GLPI (se cachean durante la sesión). */
  static getDropdown(session: GLPISession, dropdownItemtype: string, visibilityField?: string): Promise<DropdownOption[]> {
    if (session.isMock) return Promise.resolve(MOCK_DROPDOWNS[dropdownItemtype] || []);

    const key = `${session.sessionToken}#${dropdownItemtype}#${visibilityField || ''}`;
    if (!this.dropdownCache.has(key)) {
      const promise = GLPIService.fetchAllPages(session, dropdownItemtype).then(rows =>
        rows
          // Estados: GLPI permite limitar en qué tipos de activo se usa cada uno
          .filter((row: any) => !visibilityField || row[visibilityField] === undefined || Number(row[visibilityField]) === 1)
          .map((row: any) => ({
            id: Number(row.id),
            // Ubicaciones y estados jerárquicos traen la ruta completa en completename
            label: GLPIService.htmlToPlainText(String(row.completename || row.name || `#${row.id}`))
          }))
          .sort((a, b) => a.label.localeCompare(b.label, 'es'))
      );
      promise.catch(() => this.dropdownCache.delete(key));
      this.dropdownCache.set(key, promise);
    }
    return this.dropdownCache.get(key)!;
  }

  /**
   * Usuarios para el campo "Usuario" del activo: TODOS los no borrados, no solo los activos.
   * En GLPI la mayoría de quienes tienen un equipo asignado son cuentas inactivas (no inician
   * sesión), así que se incluyen marcadas como "(inactivo)".
   */
  static getUserOptions(session: GLPISession): Promise<DropdownOption[]> {
    if (session.isMock) return GLPIService.getActiveUsers(session).then(users => users.map(u => ({ id: u.id, label: u.name })));

    const key = `${session.sessionToken}#User`;
    if (!this.dropdownCache.has(key)) {
      const promise = GLPIService.fetchAllPages(session, 'User').then(rows =>
        rows
          .filter((u: any) => !Number(u.is_deleted))
          .map((u: any) => ({
            id: Number(u.id),
            label: `${GLPIService.userDisplayName(u)}${Number(u.is_active) === 1 ? '' : ' (inactivo)'}`
          }))
          .sort((a, b) => a.label.localeCompare(b.label, 'es'))
      );
      promise.catch(() => this.dropdownCache.delete(key));
      this.dropdownCache.set(key, promise);
    }
    return this.dropdownCache.get(key)!;
  }
}
