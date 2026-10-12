export interface GLPIAuthConfig {
  baseUrl: string;
  appToken: string;
  username?: string;
  password?: string;
  userToken?: string;
  useMock?: boolean;
}

export interface GLPISession {
  sessionToken: string;
  baseUrl: string;
  appToken: string;
  userToken?: string;
  username?: string;
  realname?: string;
  firstname?: string;
  userId?: number;
  activeProfile?: string;
  activeEntity?: string;
  isMock?: boolean;
}

export interface GLPITicket {
  id: number;
  name: string;
  content: string;
  status: number; // 1: Nuevo, 2: En curso, 3: Planificado, 4: En espera, 5: Resuelto, 6: Cerrado
  priority: number;
  urgency: number;
  impact: number;
  date: string;
  date_mod: string;
  solvedate?: string;
  closedate?: string;
  users_id_recipient?: number;
  users_id_lastupdater?: number;
  itilcategories_id?: number;
  category_name?: string;
  user_name?: string;
  assigned_to?: string;
}

export interface GLPIFollowup {
  id: number;
  tickets_id: number;
  content: string;
  date: string;
  date_mod: string;
  users_id?: number;
  user_name?: string;
  is_private?: number;
}

export interface GLPIUserSessionInfo {
  session: {
    glpi_plugins?: any;
    glpiID?: number;
    glpiname?: string;
    glpirealname?: string;
    glpifirstname?: string;
    glpiactiveprofile?: {
      id: number;
      name: string;
    };
    glpiactive_entity?: {
      id: number;
      name: string;
    };
  };
}

// Modelos para Proyectos y Tareas de GLPI (WBS Tree Hierarchy)
export interface GLPIProject {
  id: number;
  name: string;
  content?: string;
  percent_done: number; // 0 - 100
  date: string;
  date_mod: string;
  code?: string;
  projectstates_id?: number;
  state_name?: string;
  tasks_count?: number;
}

export interface GLPIProjectTask {
  id: number;
  projects_id: number;
  projecttasks_id: number; // ID de la tarea padre (0 si es tarea raíz)
  parent_name_ref?: string; // Referencia por nombre si GLPI devuelve el dropdown expandido
  name: string;
  content?: string;
  percent_done: number; // 0 - 100
  is_milestone: boolean; // Flag de Hito / Milestone
  state: number; // 1: No iniciada, 2: En proceso, 3: Concluida/Cerrada
  plan_start_date?: string;
  plan_end_date?: string;
  real_start_date?: string;
  real_end_date?: string;
  state_name?: string;
}

export interface ProjectTaskNode extends GLPIProjectTask {
  children: ProjectTaskNode[];
  level: number;
  isExpanded?: boolean;
}
