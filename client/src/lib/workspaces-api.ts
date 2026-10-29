import { api } from './api';

export type WorkspaceRole = 'ADMIN' | 'MEMBER';

/** Không gian kèm vai trò của mình — xem WorkspaceDto trên Swagger */
export interface Workspace {
  id: string;
  name: string;
  description: string;
  role: WorkspaceRole;
  memberCount: number;
  createdAt: string;
  /** Lúc mình tham gia — danh sách sắp theo trường này (không gian cá nhân thường đứng đầu) */
  joinedAt: string;
}

export interface WorkspaceInput {
  name: string;
  description?: string;
}

export const WORKSPACE_ROLE_LABEL: Record<WorkspaceRole, string> = { ADMIN: 'Quản trị viên', MEMBER: 'Thành viên' };

export const MAX_WORKSPACE_NAME = 100;
export const MAX_WORKSPACE_DESCRIPTION = 500;

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const workspacesApi = {
  list: () => api<{ workspaces: Workspace[] }>('/workspaces').then((r) => r.workspaces),
  get: (id: string) => api<{ workspace: Workspace }>(`/workspaces/${encodeURIComponent(id)}`).then((r) => r.workspace),
  create: (input: WorkspaceInput) => api<{ workspace: Workspace }>('/workspaces', send('POST', input)).then((r) => r.workspace),
  update: (id: string, input: Partial<WorkspaceInput>) =>
    api<{ workspace: Workspace }>(`/workspaces/${encodeURIComponent(id)}`, send('PATCH', input)).then((r) => r.workspace),
};
