import { useEffect, useSyncExternalStore } from 'react';
import { errorMessage } from './api';
import { workspacesApi, type Workspace, type WorkspaceInput } from './workspaces-api';

/*
 * Danh sách không gian của user, dùng chung cho sidebar, menu header, trang /boards, form tạo bảng...
 * Cùng cách làm với boards-store: tải 1 lần, thao tác cập nhật thẳng vào đây; server báo `workspaces:changed` → tải lại.
 */

interface WorkspacesState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  workspaces: Workspace[];
  error: string | null;
}

const INITIAL: WorkspacesState = { status: 'idle', workspaces: [], error: null };

let state: WorkspacesState = INITIAL;
let loading: Promise<void> | null = null;
/** Tăng mỗi lần reset → bỏ qua kết quả tải của phiên đăng nhập trước */
let generation = 0;
const listeners = new Set<() => void>();

function setState(patch: Partial<WorkspacesState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export const workspacesStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getSnapshot: () => state,

  /** Tải danh sách nếu chưa có (force = tải lại). */
  load(force = false): Promise<void> {
    if (loading) return loading;
    if (state.status === 'ready' && !force) return Promise.resolve();

    const gen = generation;
    if (state.status !== 'ready') setState({ status: 'loading', error: null });
    loading = workspacesApi
      .list()
      .then((workspaces) => {
        if (gen === generation) setState({ status: 'ready', workspaces, error: null });
      })
      .catch((e) => {
        if (gen === generation) setState({ status: 'error', error: errorMessage(e) });
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  },

  /** Xoá dữ liệu khi đăng nhập / đăng xuất. */
  reset() {
    generation++;
    loading = null;
    state = INITIAL;
    listeners.forEach((listener) => listener());
  },

  async create(input: WorkspaceInput) {
    const workspace = await workspacesApi.create(input);
    setState({ workspaces: [...state.workspaces, workspace] });
    return workspace;
  },

  async update(id: string, input: Partial<WorkspaceInput>) {
    const workspace = await workspacesApi.update(id, input);
    setState({ workspaces: state.workspaces.map((w) => (w.id === id ? workspace : w)) });
    return workspace;
  },
};

/** Trạng thái đầy đủ (status, error) — tự tải khi component mount. */
export function useWorkspacesState() {
  const snapshot = useSyncExternalStore(workspacesStore.subscribe, workspacesStore.getSnapshot, workspacesStore.getSnapshot);
  useEffect(() => {
    void workspacesStore.load();
  }, []);
  return snapshot;
}

export function useWorkspaces() {
  return useWorkspacesState().workspaces;
}
