// Base de conocimiento de GLPI (solo consulta).
// Solo se muestran artículos PUBLICADOS: en GLPI un artículo se publica al darle al menos un
// destinatario (entidad, grupo, perfil o usuario); marcarlo como FAQ no lo publica. Sin
// destinatarios GLPI lo muestra con el ojo tachado y solo lo ve su autor (o quien administra la
// base), así que la app lo oculta también para ellos. Además, GLPI solo devuelve a cada usuario
// los artículos publicados para él, y se respetan las fechas de publicación.

import DOMPurify from 'dompurify';
import type { GLPISession } from '../types/glpi';
import { GLPIService } from './glpiService';

export interface KbCategory {
  id: number;
  name: string;
  completename: string;
  parentId: number;
}

export interface KbArticle {
  id: number;
  title: string;
  isFaq: boolean;       // publicado en la FAQ (público)
  views: number;
  dateMod: string;
  categoryIds: number[];
  snippet: string;      // inicio del texto, para la lista
}

export interface KbAttachment {
  id: number;
  name: string;
  filename: string;
  mime: string;
}

export interface KbArticleContent {
  html: string;              // HTML ya sanitizado, con las imágenes como object URLs
  attachments: KbAttachment[];
  objectUrls: string[];      // para liberarlas al cerrar el artículo
}

const headers = (session: GLPISession) => ({
  'Content-Type': 'application/json',
  'App-Token': session.appToken,
  'Session-Token': session.sessionToken
});

// GLPI devuelve el contenido con las etiquetas escapadas ("&#60;p&#62;...")
const decodeEntities = (value: string): string => {
  if (!/&(#\d+|lt|gt|quot|amp);/.test(value)) return value;
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
};

const plainText = (html: string): string =>
  (new DOMParser().parseFromString(html, 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim();

// Un artículo con fechas de publicación solo se muestra dentro de ellas
const isPublishedNow = (item: any): boolean => {
  const now = Date.now();
  const begin = item.begin_date ? new Date(String(item.begin_date).replace(' ', 'T')).getTime() : NaN;
  const end = item.end_date ? new Date(String(item.end_date).replace(' ', 'T')).getTime() : NaN;
  return !(begin > now) && !(end < now);
};

// ── Modo demo ───────────────────────────────────────────────────────────────
const MOCK_CATEGORIES: KbCategory[] = [
  { id: 1, name: 'Software', completename: 'Software', parentId: 0 },
  { id: 2, name: 'ERP', completename: 'Software > ERP', parentId: 1 },
  { id: 3, name: 'Redes', completename: 'Redes', parentId: 0 }
];
const MOCK_ARTICLES: (KbArticle & { html: string })[] = [
  {
    id: 1, title: 'Instalación de licencias del ERP', isFaq: true, views: 17, dateMod: '2026-10-02 17:50:00', categoryIds: [2],
    snippet: '',
    html: '<h1>Instalación de licencias</h1><h3>Pasos</h3><p>1.- Descarga el archivo de licencia que envía el proveedor.</p><p>2.- Cópialo en <strong>C:\\ERP\\Licencias</strong> y reinicia el servicio.</p>'
  },
  {
    id: 2, title: 'Conectarse a la VPN de la oficina', isFaq: false, views: 5, dateMod: '2026-09-20 10:00:00', categoryIds: [3],
    snippet: '',
    html: '<p>Usa el cliente VPN con tu usuario de dominio.</p><table><tbody><tr><td>Servidor</td><td>vpn.ejemplo.com</td></tr><tr><td>Puerto</td><td>443</td></tr></tbody></table>'
  }
].map(a => ({ ...a, snippet: a.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) }));

export class KnowledgeService {
  /** Categorías de la base de conocimiento (con jerarquía). */
  static async getCategories(session: GLPISession): Promise<KbCategory[]> {
    if (session.isMock) return MOCK_CATEGORIES;
    const rows = await GLPIService.fetchAllPages(session, 'KnowbaseItemCategory');
    return rows.map((r: any) => ({
      id: Number(r.id),
      name: GLPIService.htmlToPlainText(String(r.name || '')),
      completename: GLPIService.htmlToPlainText(String(r.completename || r.name || '')),
      parentId: Number(r.knowbaseitemcategories_id) || 0
    })).sort((a, b) => a.completename.localeCompare(b.completename, 'es'));
  }

  /** Artículos publicados que el usuario puede ver, con sus categorías. */
  static async getArticles(session: GLPISession): Promise<KbArticle[]> {
    if (session.isMock) return MOCK_ARTICLES.filter(a => a.isFaq).map(({ html: _html, ...a }) => a);

    // Destinatarios de cada artículo (las 4 formas de publicar en GLPI)
    const TARGET_TABLES = ['Entity_KnowbaseItem', 'Group_KnowbaseItem', 'KnowbaseItem_Profile', 'KnowbaseItem_User'];
    const [items, links, ...targetLists] = await Promise.all([
      GLPIService.fetchAllPages(session, 'KnowbaseItem'),
      GLPIService.fetchAllPages(session, 'KnowbaseItem_KnowbaseItemCategory').catch(() => [] as any[]),
      ...TARGET_TABLES.map(t => this.fetchTargets(session, t))
    ]);
    // Si el perfil no puede consultar ninguna tabla de destinatarios, se confía en GLPI (que ya
    // oculta a cada usuario lo que no le fue publicado; solo el autor vería sus borradores)
    const readable = targetLists.filter((list): list is any[] => list !== null);
    const published = new Set<number>(readable.flat().map((t: any) => Number(t.knowbaseitems_id)));
    const isPublished = (item: any) => readable.length === 0 || published.has(Number(item.id));

    const categoriesOf = new Map<number, number[]>();
    links.forEach((l: any) => {
      const id = Number(l.knowbaseitems_id);
      if (!categoriesOf.has(id)) categoriesOf.set(id, []);
      categoriesOf.get(id)!.push(Number(l.knowbaseitemcategories_id));
    });
    return items
      .filter((item: any) => isPublished(item) && isPublishedNow(item))
      .map((item: any) => ({
        id: Number(item.id),
        title: GLPIService.htmlToPlainText(String(item.name || `Artículo #${item.id}`)),
        isFaq: Number(item.is_faq) === 1,
        views: Number(item.view) || 0,
        dateMod: String(item.date_mod || item.date_creation || ''),
        categoryIds: categoriesOf.get(Number(item.id)) || [],
        snippet: plainText(decodeEntities(String(item.answer || ''))).slice(0, 160)
      }))
      .sort((a, b) => b.dateMod.localeCompare(a.dateMod));
  }

  /**
   * Filas de una tabla de destinatarios, o null si el perfil no tiene permiso para consultarla
   * (distinto de "sin filas": así no se ocultan artículos por falta de permiso).
   */
  private static async fetchTargets(session: GLPISession, table: string): Promise<any[] | null> {
    const rows: any[] = [];
    for (let offset = 0; offset < 5000; offset += 50) {
      const res = await fetch(`${session.baseUrl}/apirest.php/${table}?range=${offset}-${offset + 49}`, { headers: headers(session) });
      if (res.status === 401 || res.status === 403) return offset === 0 ? null : rows;
      if (!res.ok) break; // 400 al pasarse del total: fin normal
      const page = await res.json();
      if (!Array.isArray(page) || page.length === 0) break;
      rows.push(...page);
      if (res.status === 200) break; // 200 = ya entregó todo; 206 = hay más
    }
    return rows;
  }

  /**
   * Contenido de un artículo listo para mostrarse: HTML sanitizado (sin scripts ni eventos),
   * enlaces que abren en otra pestaña e imágenes de GLPI descargadas con la sesión.
   */
  static async getArticleContent(session: GLPISession, articleId: number): Promise<KbArticleContent> {
    if (session.isMock) {
      const article = MOCK_ARTICLES.find(a => a.id === articleId);
      return { html: DOMPurify.sanitize(article?.html || ''), attachments: [], objectUrls: [] };
    }

    const [itemRes, linksRes] = await Promise.all([
      fetch(`${session.baseUrl}/apirest.php/KnowbaseItem/${articleId}`, { headers: headers(session) }),
      fetch(`${session.baseUrl}/apirest.php/KnowbaseItem/${articleId}/Document_Item?range=0-200`, { headers: headers(session) })
    ]);
    if (!itemRes.ok) throw new Error(`No se pudo abrir el artículo (${itemRes.status})`);
    const item = await itemRes.json();
    const links = linksRes.ok ? await linksRes.json() : [];

    const clean = DOMPurify.sanitize(decodeEntities(String(item.answer || '')), {
      FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed'],
      ADD_ATTR: ['target']
    });
    const doc = new DOMParser().parseFromString(clean, 'text/html');

    // Enlaces: los que apuntan a otro artículo de GLPI se abren dentro de la app (data-kb-id);
    // el resto, en otra pestaña y sin acceso a esta ventana
    doc.querySelectorAll('a[href]').forEach(a => {
      const linked = /knowbaseitem\.form\.php\?(?:.*&)?id=(\d+)/.exec(a.getAttribute('href') || '');
      if (linked) a.setAttribute('data-kb-id', linked[1]);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });

    // Imágenes de GLPI (front/document.send.php?docid=N): se descargan por la API con la sesión
    const objectUrls: string[] = [];
    await Promise.all([...doc.querySelectorAll('img')].map(async img => {
      const src = img.getAttribute('src') || '';
      const docId = Number(/[?&]docid=(\d+)/.exec(src)?.[1]);
      img.setAttribute('loading', 'lazy');
      if (!docId) return;
      try {
        const url = await GLPIService.getPhotoObjectUrl(session, { id: docId, name: '', filename: '', date: '' });
        objectUrls.push(url);
        img.setAttribute('src', url);
      } catch {
        img.setAttribute('alt', img.getAttribute('alt') || 'Imagen no disponible');
        img.removeAttribute('src');
      }
    }));

    const attachments = (await Promise.all((Array.isArray(links) ? links : []).map(async (l: any) => {
      const res = await fetch(`${session.baseUrl}/apirest.php/Document/${l.documents_id}`, { headers: headers(session) });
      if (!res.ok) return null;
      const d = await res.json();
      return { id: Number(d.id), name: String(d.name || d.filename || `Documento ${d.id}`), filename: String(d.filename || ''), mime: String(d.mime || '') };
    }))).filter(Boolean) as KbAttachment[];

    return { html: doc.body.innerHTML, attachments, objectUrls };
  }

  /** Descarga un adjunto y devuelve un object URL para abrirlo. */
  static async getAttachmentUrl(session: GLPISession, attachment: KbAttachment): Promise<string> {
    return GLPIService.getPhotoObjectUrl(session, { id: attachment.id, name: attachment.name, filename: attachment.filename, date: '' });
  }
}
