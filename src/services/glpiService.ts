import type { GLPIAuthConfig, GLPISession, GLPITicket, GLPIFollowup, GLPIUserSessionInfo, GLPIProject, GLPIProjectTask } from '../types/glpi';

// Status labels & helper functions
export const GLPI_STATUS_MAP: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'Nuevo', color: '#ef4444', bg: '#fef2f2' },
  2: { label: 'En curso (Asignado)', color: '#f59e0b', bg: '#fffbe6' },
  3: { label: 'En curso (Planificado)', color: '#3b82f6', bg: '#eff6ff' },
  4: { label: 'En espera', color: '#8b5cf6', bg: '#f5f3ff' },
  5: { label: 'Resuelto', color: '#10b981', bg: '#ecfdf5' },
  6: { label: 'Cerrado', color: '#6b7280', bg: '#f3f4f6' }
};

export const GLPI_PRIORITY_MAP: Record<number, { label: string; color: string }> = {
  1: { label: 'Muy Baja', color: '#9ca3af' },
  2: { label: 'Baja', color: '#3b82f6' },
  3: { label: 'Media', color: '#f59e0b' },
  4: { label: 'Alta', color: '#f97316' },
  5: { label: 'Muy Alta', color: '#ef4444' },
  6: { label: 'Urgente', color: '#b91c1c' }
};

// Mock data generator for demo/offline mode
const MOCK_TICKETS: GLPITicket[] = [
  {
    id: 101,
    name: 'Fallo de impresión en Departamento de Finanzas',
    content: 'La impresora principal HP LaserJet Pro no responde desde la mañana. Muestra error de conexión de red.',
    status: 1,
    priority: 4,
    urgency: 4,
    impact: 3,
    date: new Date(Date.now() - 3600000 * 2).toISOString(),
    date_mod: new Date(Date.now() - 3600000 * 2).toISOString(),
    category_name: 'Hardware / Impresoras',
    user_name: 'María García',
    assigned_to: 'Soporte TI - Nivel 1'
  },
  {
    id: 102,
    name: 'Solicitud de acceso a correo corporativo',
    content: 'Por favor crear cuenta de correo e instalar cliente Outlook para el nuevo integrante del equipo de ventas.',
    status: 2,
    priority: 3,
    urgency: 3,
    impact: 3,
    date: new Date(Date.now() - 3600000 * 24).toISOString(),
    date_mod: new Date(Date.now() - 3600000 * 5).toISOString(),
    category_name: 'Accesos / Usuarios',
    user_name: 'Carlos Mendoza',
    assigned_to: 'Administrador GLPI'
  },
  {
    id: 103,
    name: 'Actualización de antivirus en Servidor BD',
    content: 'Revisión programada de parches de seguridad y actualización de firmas en servidor de base de datos.',
    status: 3,
    priority: 5,
    urgency: 4,
    impact: 5,
    date: new Date(Date.now() - 3600000 * 48).toISOString(),
    date_mod: new Date(Date.now() - 3600000 * 12).toISOString(),
    category_name: 'Servidores / Mantenimiento',
    user_name: 'Sistemas Ops',
    assigned_to: 'Seguridad Informática'
  },
  {
    id: 104,
    name: 'Restablecimiento de contraseña VPN',
    content: 'El usuario intentó ingresar 5 veces y bloqueó su credencial VPN remota.',
    status: 5,
    priority: 2,
    urgency: 2,
    impact: 2,
    date: new Date(Date.now() - 3600000 * 72).toISOString(),
    date_mod: new Date(Date.now() - 3600000 * 4).toISOString(),
    category_name: 'Redes / VPN',
    user_name: 'Ana Beltrán',
    assigned_to: 'Mesa de Ayuda'
  }
];

const MOCK_FOLLOWUPS: Record<number, GLPIFollowup[]> = {
  101: [
    {
      id: 1,
      tickets_id: 101,
      content: 'Se acudió al sitio y se reinició el switch de red del departamento.',
      date: new Date(Date.now() - 3600000 * 1).toISOString(),
      date_mod: new Date(Date.now() - 3600000 * 1).toISOString(),
      user_name: 'Técnico de Turno'
    }
  ],
  102: [
    {
      id: 2,
      tickets_id: 102,
      content: 'Solicitud aprobada por Recursos Humanos. En proceso de alta en Active Directory.',
      date: new Date(Date.now() - 3600000 * 10).toISOString(),
      date_mod: new Date(Date.now() - 3600000 * 10).toISOString(),
      user_name: 'Administrador GLPI'
    }
  ]
};

export class GLPIService {
  private static cleanUrl(url: string): string {
    let cleaned = url.trim();
    if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
      cleaned = 'https://' + cleaned;
    }
    // Remove trailing slashes and /apirest.php if present
    cleaned = cleaned.replace(/\/+$/, '');
    if (cleaned.endsWith('/apirest.php')) {
      cleaned = cleaned.substring(0, cleaned.length - '/apirest.php'.length);
    }
    return cleaned;
  }

  private static appendQueryParams(urlStr: string, params: Record<string, string | undefined>): string {
    try {
      const url = new URL(urlStr);
      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          url.searchParams.set(key, value);
        }
      });
      return url.toString();
    } catch (_) {
      let result = urlStr;
      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          const sep = result.includes('?') ? '&' : '?';
          result += `${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        }
      });
      return result;
    }
  }

  /**
   * Inicia sesión en la API de GLPI
   */
  static async initSession(config: GLPIAuthConfig): Promise<GLPISession> {
    if (config.useMock) {
      // Retornar sesión simulada para pruebas
      return {
        sessionToken: 'demo_session_token_' + Date.now(),
        baseUrl: config.baseUrl || 'http://localhost/glpi',
        appToken: config.appToken || 'demo_app_token',
        username: config.username || 'Usuario Demo GLPI',
        realname: 'Demo',
        firstname: 'GLPI',
        userId: 1,
        activeProfile: 'Super-Admin',
        activeEntity: 'Entidad Raíz',
        isMock: true
      };
    }

    const baseUrl = this.cleanUrl(config.baseUrl);
    const cleanAppToken = config.appToken.trim();
    const apiUrl = this.appendQueryParams(`${baseUrl}/apirest.php/initSession`, {
      app_token: cleanAppToken
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'App-Token': cleanAppToken
    };

    if (config.userToken && config.userToken.trim() !== '') {
      headers['Authorization'] = `user_token ${config.userToken.trim()}`;
    } else if (config.username && config.password) {
      const authStr = `${config.username.trim()}:${config.password}`;
      headers['Authorization'] = `Basic ${btoa(unescape(encodeURIComponent(authStr)))}`;
    } else {
      throw new Error('Debes proporcionar usuario/contraseña o Token de Usuario GLPI');
    }

    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        let errorMsg = `Error de autenticación (${response.status})`;
        try {
          const errData = await response.json();
          if (Array.isArray(errData) && errData[1]) {
            errorMsg = errData[1];
          } else if (errData.message) {
            errorMsg = errData.message;
          }
        } catch (_) {}

        if (response.status === 400) {
          throw new Error(`Glpi API: ${errorMsg}. Revisa que el App-Token esté activo ("Activo = SÍ") en la configuración de Clientes API de tu GLPI.`);
        } else if (response.status === 401) {
          throw new Error(`Credenciales incorrectas: ${errorMsg}`);
        } else {
          throw new Error(errorMsg);
        }
      }

      const data = await response.json();
      const sessionToken = data.session_token;

      if (!sessionToken) {
        throw new Error('Respuesta inválida de GLPI: no se recibió session_token');
      }

      // Obtener detalles del usuario autenticado
      let userInfo: Partial<GLPISession> = {};
      try {
        const fullSessionUrl = this.appendQueryParams(`${baseUrl}/apirest.php/getFullSession`, {
          app_token: cleanAppToken,
          session_token: sessionToken
        });
        const fullSessionRes = await fetch(fullSessionUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'App-Token': cleanAppToken,
            'Session-Token': sessionToken
          }
        });
        if (fullSessionRes.ok) {
          const fullData: GLPIUserSessionInfo = await fullSessionRes.json();
          userInfo = {
            username: fullData.session?.glpiname || config.username,
            realname: fullData.session?.glpirealname,
            firstname: fullData.session?.glpifirstname,
            userId: fullData.session?.glpiID,
            activeProfile: fullData.session?.glpiactiveprofile?.name,
            activeEntity: fullData.session?.glpiactive_entity?.name
          };
        }
      } catch (e) {
        console.warn('No se pudo obtener información detallada del perfil GLPI:', e);
      }

      return {
        sessionToken,
        baseUrl,
        appToken: cleanAppToken,
        userToken: config.userToken,
        username: userInfo.username || config.username || 'Usuario GLPI',
        realname: userInfo.realname,
        firstname: userInfo.firstname,
        userId: userInfo.userId,
        activeProfile: userInfo.activeProfile || 'Usuario de API',
        activeEntity: userInfo.activeEntity || 'Entidad Principal',
        isMock: false
      };
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error(`Error de Red / CORS: No se pudo conectar a ${apiUrl}. Verifica la URL, conexión de red o habilita solicitudes CORS en tu servidor GLPI.`);
      }
      throw err;
    }
  }

  /**
   * Obtiene la lista de Tickets de GLPI
   */
  static async getTickets(session: GLPISession): Promise<GLPITicket[]> {
    if (session.isMock) {
      return [...MOCK_TICKETS];
    }

    const url = this.appendQueryParams(
      `${session.baseUrl}/apirest.php/Ticket?expand_dropdowns=true&order=DESC&sort=date_mod&range=0-50`,
      { app_token: session.appToken, session_token: session.sessionToken }
    );
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'App-Token': session.appToken,
        'Session-Token': session.sessionToken
      }
    });

    if (!response.ok) {
      throw new Error(`Error obteniendo tickets: ${response.statusText}`);
    }

    const rawData = await response.json();
    if (!Array.isArray(rawData)) {
      return [];
    }

    return rawData.map((item: any) => ({
      id: item.id,
      name: item.name || 'Sin título',
      content: item.content || '',
      status: Number(item.status) || 1,
      priority: Number(item.priority) || 3,
      urgency: Number(item.urgency) || 3,
      impact: Number(item.impact) || 3,
      date: item.date || item.date_mod || new Date().toISOString(),
      date_mod: item.date_mod || new Date().toISOString(),
      category_name: typeof item.itilcategories_id === 'string' ? item.itilcategories_id : (item.itilcategories_id?.name || 'General'),
      user_name: item.users_id_recipient || 'Usuario GLPI',
      assigned_to: item.users_id_lastupdater || 'Técnico asignado'
    }));
  }

  /**
   * Obtener detalle de un Ticket específico
   */
  static async getTicketById(session: GLPISession, ticketId: number): Promise<GLPITicket> {
    if (session.isMock) {
      const found = MOCK_TICKETS.find(t => t.id === ticketId);
      if (found) return found;
      throw new Error('Ticket no encontrado');
    }

    const url = `${session.baseUrl}/apirest.php/Ticket/${ticketId}?expand_dropdowns=true`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'App-Token': session.appToken,
        'Session-Token': session.sessionToken
      }
    });

    if (!response.ok) {
      throw new Error(`No se pudo obtener el ticket ${ticketId}`);
    }

    const item = await response.json();
    return {
      id: item.id,
      name: item.name || 'Sin título',
      content: item.content || '',
      status: Number(item.status) || 1,
      priority: Number(item.priority) || 3,
      urgency: Number(item.urgency) || 3,
      impact: Number(item.impact) || 3,
      date: item.date || new Date().toISOString(),
      date_mod: item.date_mod || new Date().toISOString(),
      category_name: typeof item.itilcategories_id === 'string' ? item.itilcategories_id : (item.itilcategories_id?.name || 'General'),
      user_name: item.users_id_recipient || 'Usuario GLPI',
      assigned_to: item.users_id_lastupdater || 'Soporte'
    };
  }

  /**
   * Obtiene los seguimientos / comentarios de un Ticket
   */
  static async getFollowups(session: GLPISession, ticketId: number): Promise<GLPIFollowup[]> {
    if (session.isMock) {
      return MOCK_FOLLOWUPS[ticketId] || [];
    }

    const url = `${session.baseUrl}/apirest.php/Ticket/${ticketId}/ITILFollowup?expand_dropdowns=true`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'App-Token': session.appToken,
        'Session-Token': session.sessionToken
      }
    });

    if (!response.ok) {
      return [];
    }

    const raw = await response.json();
    if (!Array.isArray(raw)) return [];

    return raw.map((item: any) => ({
      id: item.id,
      tickets_id: ticketId,
      content: item.content || '',
      date: item.date || new Date().toISOString(),
      date_mod: item.date_mod || new Date().toISOString(),
      user_name: item.users_id || 'Técnico GLPI',
      is_private: Number(item.is_private) || 0
    }));
  }

  /**
   * Crea un nuevo Ticket en GLPI
   */
  static async createTicket(session: GLPISession, ticketData: { name: string; content: string; urgency: number }): Promise<GLPITicket> {
    if (session.isMock) {
      const newMockTicket: GLPITicket = {
        id: Math.floor(105 + Math.random() * 900),
        name: ticketData.name,
        content: ticketData.content,
        status: 1, // Nuevo
        priority: ticketData.urgency,
        urgency: ticketData.urgency,
        impact: 3,
        date: new Date().toISOString(),
        date_mod: new Date().toISOString(),
        category_name: 'Soporte General',
        user_name: session.username || 'Usuario Actual',
        assigned_to: 'Pendiente de Asignar'
      };
      MOCK_TICKETS.unshift(newMockTicket);
      return newMockTicket;
    }

    const url = `${session.baseUrl}/apirest.php/Ticket`;
    const payload = {
      input: {
        name: ticketData.name,
        content: ticketData.content,
        urgency: ticketData.urgency
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'App-Token': session.appToken,
        'Session-Token': session.sessionToken
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Error al crear ticket en GLPI (${response.status})`);
    }

    const resData = await response.json();
    const createdId = resData.id || resData[0]?.id;

    if (createdId) {
      return this.getTicketById(session, createdId);
    }

    return {
      id: 0,
      name: ticketData.name,
      content: ticketData.content,
      status: 1,
      priority: ticketData.urgency,
      urgency: ticketData.urgency,
      impact: 3,
      date: new Date().toISOString(),
      date_mod: new Date().toISOString()
    };
  }

  /**
   * Añadir un seguimiento / comentario a un Ticket
   */
  static async addFollowup(session: GLPISession, ticketId: number, content: string): Promise<GLPIFollowup> {
    if (session.isMock) {
      const newFollowup: GLPIFollowup = {
        id: Date.now(),
        tickets_id: ticketId,
        content: content,
        date: new Date().toISOString(),
        date_mod: new Date().toISOString(),
        user_name: session.username || 'Técnico GLPI'
      };
      if (!MOCK_FOLLOWUPS[ticketId]) {
        MOCK_FOLLOWUPS[ticketId] = [];
      }
      MOCK_FOLLOWUPS[ticketId].push(newFollowup);
      return newFollowup;
    }

    const url = `${session.baseUrl}/apirest.php/Ticket/${ticketId}/ITILFollowup`;
    const payload = {
      input: {
        tickets_id: ticketId,
        content: content
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'App-Token': session.appToken,
        'Session-Token': session.sessionToken
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('No se pudo enviar el comentario al ticket');
    }

    return {
      id: Date.now(),
      tickets_id: ticketId,
      content,
      date: new Date().toISOString(),
      date_mod: new Date().toISOString(),
      user_name: session.username || 'Usuario GLPI'
    };
  }

  /**
   * Cierra sesión en GLPI
   */
  /**
   * Comprueba que la sesión de GLPI siga viva (y la mantiene activa en el servidor).
   * Devuelve false solo si GLPI la rechaza (401); ante errores de red devuelve true para
   * no cerrar la sesión por una caída momentánea de conexión.
   */
  static async pingSession(session: GLPISession): Promise<boolean> {
    if (session.isMock) return true;
    try {
      const response = await fetch(`${session.baseUrl}/apirest.php/getActiveProfile`, {
        headers: {
          'Content-Type': 'application/json',
          'App-Token': session.appToken,
          'Session-Token': session.sessionToken
        }
      });
      return response.status !== 401;
    } catch {
      return true;
    }
  }

  static async killSession(session: GLPISession): Promise<void> {
    if (session.isMock) return;

    try {
      await fetch(`${session.baseUrl}/apirest.php/killSession`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'App-Token': session.appToken,
          'Session-Token': session.sessionToken
        }
      });
    } catch (e) {
      console.warn('Error al cerrar sesión en GLPI:', e);
    }
  }

  /**
   * Obtiene la lista de Proyectos de GLPI
   */
  static async getProjects(session: GLPISession): Promise<GLPIProject[]> {
    if (session.isMock) {
      return [...MOCK_PROJECTS];
    }

    const url = this.appendQueryParams(
      `${session.baseUrl}/apirest.php/Project?expand_dropdowns=true&order=DESC&sort=date_mod&range=0-100`,
      { app_token: session.appToken, session_token: session.sessionToken }
    );

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'App-Token': session.appToken,
          'Session-Token': session.sessionToken
        }
      });

      if (!response.ok) {
        return [...MOCK_PROJECTS];
      }

      const raw = await response.json();
      if (!Array.isArray(raw)) return [...MOCK_PROJECTS];

      return raw.map((item: any) => ({
        id: Number(item.id),
        name: item.name || 'Proyecto sin nombre',
        content: item.content || '',
        percent_done: Number(item.percent_done) || 0,
        date: item.date || new Date().toISOString(),
        date_mod: item.date_mod || new Date().toISOString(),
        code: item.code || `PRJ-${item.id}`,
        state_name: typeof item.projectstates_id === 'string' ? item.projectstates_id : (item.projectstates_id?.name || 'Activo')
      }));
    } catch (err) {
      console.warn('Error fetching real projects, falling back to mock:', err);
      return [...MOCK_PROJECTS];
    }
  }

  /**
   * Obtiene la lista COMPLETA de tareas de un proyecto en GLPI.
   *
   * Estrategia correcta para GLPI:
   * 1. Cargar TODOS los ProjectTask globalmente (paginado)
   * 2. Identificar las tareas que pertenecen directamente al proyecto (projects_id === projectId)
   * 3. Construir un índice de hijos por parentId
   * 4. Recolectar recursivamente todos los descendientes de las tareas raíz
   *    (Las sub-tareas anidadas tienen projects_id=0 en GLPI — solo el padre directo lo tiene)
   */
  static async getProjectTasks(session: GLPISession, projectId: number): Promise<GLPIProjectTask[]> {
    if (session.isMock) {
      return [...(MOCK_PROJECT_TASKS[projectId] || MOCK_PROJECT_TASKS[1] || [])];
    }

    const globalMap = new Map<number, GLPIProjectTask>(); // TODAS las tareas del sistema

    try {
      // ═══ PASO 1: Cargar las tareas ═══
      // GLPI filtra los LISTADOS de ProjectTask (ProjectTask, Project/X/ProjectTask, search,
      // sub-items) a las tareas donde el usuario es creador o miembro del equipo, aun con
      // perfil Super-Admin. La lectura por ID sí devuelve cualquier tarea, así que:
      //  a) el listado (filtrado) da una cota del ID más alto conocido
      //  b) se recorren todos los IDs en lotes con getMultipleItems
      const listed = await this.fetchAllPages(session, 'ProjectTask');
      const maxListedId = listed.reduce((max: number, item: any) => Math.max(max, Number(item.id) || 0), 0);
      const scanned = await this.fetchProjectTasksById(session, maxListedId);

      [...scanned, ...listed].forEach((item: any) => {
        const mapped = this.mapRawTask(item);
        if (!globalMap.has(mapped.id)) globalMap.set(mapped.id, mapped);
      });

      console.log(`[GLPI] Tareas visibles en listado: ${listed.length}, recuperadas por ID: ${scanned.length}`);
      console.log(`[GLPI] Total tareas en sistema: ${globalMap.size}`);

      // ═══ PASO 2: Construir índice de hijos por parentId ═══
      const childrenIndex = new Map<number, number[]>(); // parentId → [childId, ...]
      globalMap.forEach((task) => {
        const pid = task.projecttasks_id || 0;
        if (!childrenIndex.has(pid)) childrenIndex.set(pid, []);
        childrenIndex.get(pid)!.push(task.id);
      });

      // ═══ PASO 3: Identificar raíces del proyecto ═══
      // En GLPI, las tareas raíz tienen projects_id === projectId y projecttasks_id === 0
      // (o cualquier valor que no existe en el mapa = orphan)
      const projectRootIds: number[] = [];
      globalMap.forEach((task) => {
        if (task.projects_id === projectId) {
          // Verificar si su padre también pertenece al proyecto
          const parentInProject = task.projecttasks_id > 0 && globalMap.get(task.projecttasks_id)?.projects_id === projectId;
          if (!parentInProject) {
            projectRootIds.push(task.id);
          }
        }
      });

      console.log(`[GLPI] Raíces del proyecto ${projectId}: ${projectRootIds.length}`, projectRootIds);

      // ═══ PASO 4: Recolectar recursivamente todos los descendientes ═══
      const result = new Map<number, GLPIProjectTask>();

      const collectDescendants = (taskId: number) => {
        const task = globalMap.get(taskId);
        if (!task || result.has(taskId)) return;
        result.set(taskId, task);
        // Recolectar hijos (aunque tengan projects_id=0, son parte del árbol)
        const children = childrenIndex.get(taskId) || [];
        children.forEach(childId => collectDescendants(childId));
      };

      projectRootIds.forEach(rootId => collectDescendants(rootId));

      const tasksList = Array.from(result.values());
      console.log(`[GLPI] Tareas del proyecto ${projectId}: ${tasksList.length} (de ${globalMap.size} totales en el sistema)`);
      return tasksList;

    } catch (err: any) {
      console.error('Error cargando tareas de GLPI:', err);
      throw new Error(`Error al conectar con la API de GLPI: ${err.message || err}`);
    }
  }


  /**
   * Recupera TODAS las tareas de proyecto leyéndolas por ID con getMultipleItems.
   *
   * - getMultipleItems falla completo (404) si algún ID del lote no existe (tareas borradas);
   *   en ese caso el lote se divide (ver fetchIds).
   * - El servidor procesa ~40 peticiones/s, así que lo que cuesta es el NÚMERO de peticiones.
   *   Como MySQL no reutiliza IDs, los IDs borrados se recuerdan en localStorage y se omiten
   *   en las siguientes cargas: así todos los lotes aciertan a la primera.
   * - Más allá del ID más alto conocido se sigue explorando hasta encontrar varios lotes vacíos
   *   seguidos (tareas creadas desde la última carga).
   */
  private static async fetchProjectTasksById(session: GLPISession, minMaxId: number): Promise<any[]> {
    const batchSize = 25;
    const tailBatchSize = 10;
    const emptyTailBatchesToStop = 2;
    const cacheKey = `glpi_projecttask_scan:${session.baseUrl}`;
    const headers = {
      'Content-Type': 'application/json',
      'App-Token': session.appToken,
      'Session-Token': session.sessionToken
    };

    let cached: { maxId: number; missing: number[] } = { maxId: 0, missing: [] };
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) cached = JSON.parse(raw);
    } catch { /* sin localStorage (modo privado, Node): explorar sin caché */ }
    const knownMissing = new Set(cached.missing);

    // Si el lote falla: 'bisect' lo parte en mitades (barato cuando faltan pocos IDs, caso del
    // rango conocido); 'singles' pide cada ID por separado (barato cuando faltan casi todos, caso
    // de la exploración final).
    const fetchIds = async (ids: number[], onMissing: 'bisect' | 'singles' = 'bisect'): Promise<any[]> => {
      if (ids.length === 0) return [];
      const qs = ids
        .map((id, i) => `items[${i}][itemtype]=ProjectTask&items[${i}][items_id]=${id}`)
        .join('&');
      const response = await fetch(`${session.baseUrl}/apirest.php/getMultipleItems?${qs}`, { headers });
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data) ? data.filter((x: any) => x && typeof x === 'object' && x.id) : [];
      }
      if (response.status !== 404 || ids.length === 1) return [];
      const parts = onMissing === 'singles'
        ? ids.map(id => [id])
        : [ids.slice(0, Math.ceil(ids.length / 2)), ids.slice(Math.ceil(ids.length / 2))];
      return (await Promise.all(parts.map(part => fetchIds(part, onMissing)))).flat();
    };

    // Fase 1: rango conocido, omitiendo los IDs que ya sabemos borrados
    const knownMax = Math.max(minMaxId, cached.maxId);
    const candidates: number[] = [];
    for (let id = 1; id <= knownMax; id++) {
      if (!knownMissing.has(id)) candidates.push(id);
    }
    const batches: number[][] = [];
    for (let i = 0; i < candidates.length; i += batchSize) {
      batches.push(candidates.slice(i, i + batchSize));
    }
    const items: any[] = (await Promise.all(batches.map(batch => fetchIds(batch)))).flat();

    // Fase 2: explorar más allá del máximo conocido
    let nextId = knownMax + 1;
    let emptyInARow = 0;
    while (emptyInARow < emptyTailBatchesToStop && nextId < 100000) {
      const found = await fetchIds(Array.from({ length: tailBatchSize }, (_, i) => nextId + i), 'singles');
      nextId += tailBatchSize;
      items.push(...found);
      emptyInARow = found.length === 0 ? emptyInARow + 1 : 0;
    }

    // Guardar los IDs inexistentes por debajo del máximo encontrado (borrados definitivamente)
    try {
      const foundIds = new Set(items.map((x: any) => Number(x.id)));
      const maxFound = Math.max(0, ...foundIds);
      const missing: number[] = [];
      for (let id = 1; id <= maxFound; id++) {
        if (!foundIds.has(id)) missing.push(id);
      }
      localStorage.setItem(cacheKey, JSON.stringify({ maxId: maxFound, missing }));
    } catch { /* sin localStorage: la próxima carga volverá a explorar completa */ }

    return items;
  }

  /**
   * Descarga todas las páginas de un endpoint de listado de GLPI.
   * GLPI recorta cada respuesta a "list_limit_max" (50 por defecto) sin importar el
   * rango pedido, así que se avanza según lo realmente recibido y se sigue pidiendo
   * hasta obtener una página vacía o un error (400 = rango fuera del total: fin normal).
   */
  private static async fetchAllPages(session: GLPISession, path: string): Promise<any[]> {
    const pageSize = 50;
    const items: any[] = [];
    let offset = 0;
    let total = Infinity;

    while (offset < total && offset < 20000) {
      const url = `${session.baseUrl}/apirest.php/${path}?range=${offset}-${offset + pageSize - 1}&order=ASC&sort=id`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'App-Token': session.appToken,
          'Session-Token': session.sessionToken
        }
      });

      if (!response.ok) {
        if (offset === 0) console.warn(`[GLPI] Error cargando ${path} (${response.status})`);
        break;
      }

      const raw = await response.json();
      if (!Array.isArray(raw) || raw.length === 0) break;
      items.push(...raw);
      offset += raw.length;

      // "Content-Range: 0-49/350" — solo legible si el servidor expone la cabecera (CORS)
      const range = response.headers.get('Content-Range');
      const parsedTotal = range ? Number(range.split('/')[1]) : NaN;
      if (!isNaN(parsedTotal)) total = parsedTotal;

      console.log(`[GLPI] ${path}: offset=${offset}, total=${isFinite(total) ? total : '?'}`);
    }

    return items;
  }

  private static mapRawTask(item: any): GLPIProjectTask {
    const taskName = (item.name || 'Tarea sin nombre').trim();

    // Parsear projecttasks_id (soporta entero, string de ID, string de Nombre o objeto dropdown { id: XX, name: "..." })
    let parentTaskId = 0;
    let parentNameRef = '';

    if (typeof item.projecttasks_id === 'number') {
      parentTaskId = item.projecttasks_id;
    } else if (typeof item.projecttasks_id === 'string') {
      const str = item.projecttasks_id.trim();
      const parsed = parseInt(str, 10);
      if (!isNaN(parsed) && parsed > 0) {
        parentTaskId = parsed;
        // Si la cadena es puramente numérica, es un ID (no un nombre)
        if (!/^\d+$/.test(str)) {
          // Tiene texto además de números — podría ser un nombre
          const cleanName = str.replace(/^\d+\s*[-_:]\s*/, '').trim();
          if (cleanName && cleanName !== str) parentNameRef = cleanName;
        }
      } else if (str && !/^\d+$/.test(str)) {
        // Es un nombre (vino como expand_dropdowns)
        const cleanName = str.replace(/^\d+\s*[-_:]\s*/, '').trim();
        parentNameRef = cleanName || str;
      }
    } else if (item.projecttasks_id && typeof item.projecttasks_id === 'object') {
      if (item.projecttasks_id.id) {
        parentTaskId = Number(item.projecttasks_id.id) || 0;
      }
      if (item.projecttasks_id.name) {
        const nameStr = String(item.projecttasks_id.name).trim();
        const cleanName = nameStr.replace(/^\d+\s*[-_:]\s*/, '').trim();
        parentNameRef = cleanName || nameStr;
      }
    }

    // Parsear projects_id
    let projectId = 0;
    if (typeof item.projects_id === 'number') {
      projectId = item.projects_id;
    } else if (typeof item.projects_id === 'string') {
      const parsedPrj = parseInt(item.projects_id, 10);
      if (!isNaN(parsedPrj) && parsedPrj > 0) projectId = parsedPrj;
    } else if (item.projects_id && typeof item.projects_id === 'object') {
      if (item.projects_id.id) {
        projectId = Number(item.projects_id.id) || 0;
      }
    }

    // Parsear is_milestone estrictamente desde GLPI (1, true, "1", "true")
    const isMilestone = Boolean(
      item.is_milestone === 1 || 
      item.is_milestone === true || 
      item.is_milestone === '1' || 
      item.is_milestone === 'true'
    );

    return {
      id: Number(item.id),
      projects_id: projectId,
      projecttasks_id: parentTaskId,
      parent_name_ref: parentNameRef,
      name: taskName,
      content: item.content || '',
      percent_done: Number(item.percent_done) || 0,
      is_milestone: isMilestone,
      state: Number(item.state || item.projectstates_id) || (Number(item.percent_done) === 100 ? 3 : 1),
      plan_start_date: item.plan_start_date,
      plan_end_date: item.plan_end_date,
      real_start_date: item.real_start_date,
      real_end_date: item.real_end_date,
      state_name: item.state_name || (Number(item.percent_done) === 100 ? 'Concluida' : 'En proceso')
    };
  }

  /**
   * Concluye un Hito o Tarea con 1 solo clic:
   * Guarda automáticamente en GLPI: percent_done = 100%, state = 3 (closed), real_end_date = fecha actual
   */
  /** Fecha/hora LOCAL en formato GLPI ("YYYY-MM-DD HH:MM:SS"). toISOString() daría UTC (+6 h en México). */
  private static toGlpiDateTime(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
      `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  private static closedStateIdCache = new Map<string, number>();

  /**
   * ID del estado de proyecto "terminado" (Closed). Se busca el ProjectState con
   * is_finished = 1 en vez de fijarlo en el código, porque el ID depende de cada instalación.
   */
  private static async getClosedProjectStateId(session: GLPISession): Promise<number> {
    const cached = this.closedStateIdCache.get(session.baseUrl);
    if (cached) return cached;

    const fallbackId = 3; // "Closed" en una instalación por defecto de GLPI
    try {
      const response = await fetch(`${session.baseUrl}/apirest.php/ProjectState?range=0-100`, {
        headers: {
          'Content-Type': 'application/json',
          'App-Token': session.appToken,
          'Session-Token': session.sessionToken
        }
      });
      if (response.ok) {
        const states = await response.json();
        const finished = Array.isArray(states)
          ? states.find((st: any) => Number(st.is_finished) === 1)
          : null;
        if (finished?.id) {
          this.closedStateIdCache.set(session.baseUrl, Number(finished.id));
          return Number(finished.id);
        }
      }
    } catch (err) {
      console.warn('[GLPI] No se pudo consultar ProjectState, se usa el estado por defecto:', err);
    }
    return fallbackId;
  }

  /**
   * Concluye un hito con 1 clic: percent_done = 100, estado Closed y marca de tiempo
   * (real_start_date = real_end_date = momento del clic).
   */
  static async completeTaskMilestone(session: GLPISession, taskId: number, currentProjectId: number = 1): Promise<GLPIProjectTask> {
    const nowStr = this.toGlpiDateTime(new Date());

    if (session.isMock) {
      const tasks = MOCK_PROJECT_TASKS[currentProjectId] || MOCK_PROJECT_TASKS[1] || [];
      const found = tasks.find(t => t.id === taskId);
      if (found) {
        found.percent_done = 100;
        found.state = 3;
        found.real_start_date = nowStr;
        found.real_end_date = nowStr;
        found.state_name = 'Concluida';
        return { ...found };
      }
    }

    const url = this.appendQueryParams(
      `${session.baseUrl}/apirest.php/ProjectTask/${taskId}`,
      { app_token: session.appToken, session_token: session.sessionToken }
    );

    const closedStateId = await this.getClosedProjectStateId(session);
    const payload = {
      input: {
        id: taskId,
        percent_done: 100,
        // El estado de una ProjectTask es projectstates_id; un campo "state" GLPI lo ignora
        projectstates_id: closedStateId,
        // Un hito no tiene duración: inicio y fin reales son la marca de tiempo del cierre.
        // No se toca plan_end_date: es la planificación original y sobrescribirla
        // alteraba el orden de las tareas en el árbol.
        real_start_date: nowStr,
        real_end_date: nowStr
      }
    };

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'App-Token': session.appToken,
        'Session-Token': session.sessionToken
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Error al actualizar el hito en GLPI (${response.status})`);
    }

    // Actualizar mock o retorno local
    const tasks = MOCK_PROJECT_TASKS[currentProjectId] || MOCK_PROJECT_TASKS[1] || [];
    const found = tasks.find(t => t.id === taskId);
    if (found) {
      found.percent_done = 100;
      found.state = 3;
      found.real_start_date = nowStr;
      found.real_end_date = nowStr;
      found.state_name = 'Concluida';
      return { ...found };
    }

    return {
      id: taskId,
      projects_id: currentProjectId,
      projecttasks_id: 0,
      name: '',
      percent_done: 100,
      is_milestone: true,
      state: 3,
      real_start_date: nowStr,
      real_end_date: nowStr,
      state_name: 'Concluida'
    };
  }
}

// Datos MOCK para Proyectos y Tareas en Estructura de Árbol
const MOCK_PROJECTS: GLPIProject[] = [
  {
    id: 1,
    name: 'MANTENIMIENTO SEMESTRAL DE EQUIPOS DE COMPUTO (2DO SEMESTRE)',
    content: 'Proyecto de mantenimiento preventivo y correctivo para equipos de cómputo.',
    percent_done: 64,
    date: '2026-08-01 09:00:00',
    date_mod: new Date().toISOString(),
    code: 'PRJ-2026-MNT2',
    state_name: 'En curso',
    tasks_count: 13
  },
  {
    id: 2,
    name: 'MIGRACIÓN DE INFRAESTRUCTURA Y SERVIDORES',
    content: 'Actualización y migración de hipervisores y servidores.',
    percent_done: 20,
    date: '2026-09-15 10:00:00',
    date_mod: new Date().toISOString(),
    code: 'PRJ-2026-INFRA',
    state_name: 'En curso',
    tasks_count: 5
  }
];

const MOCK_PROJECT_TASKS: Record<number, GLPIProjectTask[]> = {
  1: [
    // --- RAMA 1: 5 DE SEPTIEMBRE ---
    {
      id: 10,
      projects_id: 1,
      projecttasks_id: 0,
      name: 'MANTENIMIENTO PROGRAMADOS PARA 5 DE SEPTIEMBRE DEL 2026',
      percent_done: 100,
      is_milestone: false,
      state: 3,
      plan_start_date: '2026-09-05 08:00:00',
      plan_end_date: '2026-09-05 18:00:00',
      real_end_date: '2026-09-05 17:30:00',
      state_name: 'Concluida'
    },
    {
      id: 11,
      projects_id: 1,
      projecttasks_id: 10,
      name: 'MANTENIMIENTO EQUIPO DE BERENICE',
      percent_done: 100,
      is_milestone: false,
      state: 3,
      real_end_date: '2026-09-05 10:00:00',
      state_name: 'Concluida'
    },
    {
      id: 12,
      projects_id: 1,
      projecttasks_id: 10,
      name: 'MANTENIMIENTO DE EQUIPO JOAQUIN GIL GARCIA',
      percent_done: 100,
      is_milestone: false,
      state: 3,
      real_end_date: '2026-09-05 12:00:00',
      state_name: 'Concluida'
    },
    {
      id: 13,
      projects_id: 1,
      projecttasks_id: 10,
      name: 'MANTENIMIENTO DE EQUIPO DE ENRIQUE VALLADARES',
      percent_done: 100,
      is_milestone: false,
      state: 3,
      real_end_date: '2026-09-05 14:30:00',
      state_name: 'Concluida'
    },
    {
      id: 14,
      projects_id: 1,
      projecttasks_id: 10,
      name: 'MANTENIMIENTO DE EQUIPO ROBERTO RODALL',
      percent_done: 100,
      is_milestone: false,
      state: 3,
      real_end_date: '2026-09-05 17:00:00',
      state_name: 'Concluida'
    },

    // --- RAMA 2: 10 DE OCTUBRE ---
    {
      id: 20,
      projects_id: 1,
      projecttasks_id: 0,
      name: 'MANTENIMIENTO PROGRAMADOS PARA 10 DE OCTUBRE DEL 2026',
      percent_done: 28,
      is_milestone: false,
      state: 2,
      plan_start_date: '2026-10-10 08:00:00',
      plan_end_date: '2026-10-10 18:00:00',
      state_name: 'En proceso'
    },
    {
      id: 21,
      projects_id: 1,
      projecttasks_id: 20,
      name: 'MANTENIMIENTO DE EQUIPO DE GHERSON MENA',
      percent_done: 28,
      is_milestone: false,
      state: 2,
      state_name: 'En proceso'
    },
    {
      id: 22,
      projects_id: 1,
      projecttasks_id: 21,
      name: 'PROGRAMACIÓN MANTENIMIENTO',
      percent_done: 100,
      is_milestone: true,
      state: 3,
      real_end_date: '2026-10-09 09:00:00',
      state_name: 'Concluida'
    },
    {
      id: 23,
      projects_id: 1,
      projecttasks_id: 21,
      name: 'AVISO A USUARIO DE MANTENIMIENTO',
      percent_done: 100,
      is_milestone: false,
      state: 3,
      real_end_date: '2026-10-09 10:30:00',
      state_name: 'Concluida'
    },
    {
      id: 24,
      projects_id: 1,
      projecttasks_id: 21,
      name: 'MANTENIMIENTO INICIADO',
      percent_done: 0,
      is_milestone: true,
      state: 1,
      state_name: 'No iniciada'
    },
    {
      id: 25,
      projects_id: 1,
      projecttasks_id: 21,
      name: 'MANTENIMIENTO TERMINADO',
      percent_done: 0,
      is_milestone: true,
      state: 1,
      state_name: 'No iniciada'
    },
    {
      id: 26,
      projects_id: 1,
      projecttasks_id: 21,
      name: 'SUBIDA DE EVIDENCIAS',
      percent_done: 0,
      is_milestone: true,
      state: 1,
      state_name: 'No iniciada'
    },
    {
      id: 27,
      projects_id: 1,
      projecttasks_id: 21,
      name: 'RESPONSIVA CREADA',
      percent_done: 0,
      is_milestone: true,
      state: 1,
      state_name: 'No iniciada'
    },
    {
      id: 28,
      projects_id: 1,
      projecttasks_id: 21,
      name: 'RESPONSIVA FIRMADA',
      percent_done: 0,
      is_milestone: true,
      state: 1,
      state_name: 'No iniciada'
    }
  ]
};

