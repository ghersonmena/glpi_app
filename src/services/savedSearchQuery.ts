// Conversión de la "query" de una búsqueda guardada de GLPI (la URL que guarda la interfaz web)
// a parámetros válidos para la API search/<itemtype>.
//
// La interfaz web guarda cosas que la API no acepta:
//  - criterios "Elementos vistos" (field=view) o "Todo" (field=all): la API los rechaza con
//    "ID de campo no válido". Vacíos no hacen nada y se quitan; con valor se reemplazan por un
//    grupo OR sobre las columnas principales (lo que hace la web al buscar en lo visible).
//  - índices con huecos (criteria[0], criteria[3]...): se renumeran, también en grupos anidados.
//  - parámetros de la vista (as_map, browse, sort, itemtype, savedsearches_id): se descartan.

interface Criterion {
  criteria?: Criterion[];
  [key: string]: string | Criterion[] | undefined;
}
type RawNode = { [key: string]: string | RawNode };

// Columnas en las que se busca al emular "Elementos vistos": nombre, tipo, fabricante, modelo,
// serie, inventario, ubicación, usuario, estado y comentarios
const VIEW_FIELDS = ['1', '4', '23', '40', '5', '6', '3', '70', '31', '16'];

const toList = (node: RawNode | undefined): Criterion[] =>
  Object.keys(node || {})
    .filter(k => /^\d+$/.test(k))
    .sort((a, b) => Number(a) - Number(b))
    .map(k => {
      const raw = node![k] as RawNode;
      const c: Criterion = {};
      Object.entries(raw).forEach(([key, value]) => {
        if (key === 'criteria') c.criteria = toList(value as RawNode);
        else c[key] = String(value);
      });
      return c;
    });

const normalize = (list: Criterion[]): Criterion[] =>
  list
    .map((c): Criterion => {
      if (c.criteria) return { ...c, criteria: normalize(c.criteria) };
      if ((c.field === 'view' || c.field === 'all') && c.value) {
        // Grupo OR equivalente a buscar el texto en las columnas principales
        return {
          link: c.link || 'AND',
          criteria: VIEW_FIELDS.map((field, i): Criterion => ({
            ...(i > 0 ? { link: 'OR' } : {}),
            field,
            searchtype: c.searchtype || 'contains',
            value: c.value
          }))
        };
      }
      return c;
    })
    .filter(c => {
      if (c.criteria) return c.criteria.length > 0;
      return !((c.field === 'view' || c.field === 'all') && !c.value);
    });

export const savedQueryToSearchParams = (query: string): URLSearchParams => {
  const tree: RawNode = {};
  const source = new URLSearchParams(query);

  for (const [key, value] of source) {
    const match = key.match(/^(criteria|metacriteria)((?:\[[^\]]*\])+)$/);
    if (!match) continue;
    const path = [match[1], ...[...match[2].matchAll(/\[([^\]]*)\]/g)].map(m => m[1])];
    let node: RawNode = tree;
    path.forEach((part, i) => {
      if (i === path.length - 1) node[part] = value;
      else node = (node[part] ??= {}) as RawNode;
    });
  }

  const out = new URLSearchParams();
  const emit = (prefix: string, list: Criterion[]) => list.forEach((c, i) => {
    Object.entries(c).forEach(([key, value]) => {
      if (key === 'criteria') emit(`${prefix}[${i}][criteria]`, value as Criterion[]);
      else out.append(`${prefix}[${i}][${key}]`, String(value));
    });
  });
  emit('criteria', normalize(toList(tree.criteria as RawNode)));
  emit('metacriteria', normalize(toList(tree.metacriteria as RawNode)));

  const deleted = source.get('is_deleted');
  if (deleted) out.set('is_deleted', deleted);
  return out;
};
