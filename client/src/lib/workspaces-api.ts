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

interface Person {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface WorkspaceMember extends Person {
  role: WorkspaceRole;
  joinedAt: string;
}

/** Khách: thành viên bảng của không gian nhưng không thuộc không gian (chỉ tính bảng mình cũng tham gia) */
export interface WorkspaceGuest extends Person {
  boards: { id: string; title: string }[];
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

const membersPath = (workspaceId: string, userId?: string) =>
  `/workspaces/${encodeURIComponent(workspaceId)}/members${userId ? `/${encodeURIComponent(userId)}` : ''}`;

export const workspaceMembersApi = {
  list: (workspaceId: string) => api<{ members: WorkspaceMember[]; guests: WorkspaceGuest[] }>(membersPath(workspaceId)),
  invite: (workspaceId: string, email: string, role: WorkspaceRole) =>
    api<{ member: WorkspaceMember }>(membersPath(workspaceId), send('POST', { email, role })).then((r) => r.member),
  updateRole: (workspaceId: string, userId: string, role: WorkspaceRole) =>
    api<{ member: WorkspaceMember }>(membersPath(workspaceId, userId), send('PATCH', { role })).then((r) => r.member),
  /** userId = chính mình → rời không gian. `fromBoards`: gỡ cả khỏi mọi bảng của không gian (chỉ khi xoá người khác) */
  remove: (workspaceId: string, userId: string, fromBoards = false) =>
    api<{ removedFromBoards: number }>(`${membersPath(workspaceId, userId)}?fromBoards=${fromBoards}`, send('DELETE')),
};
