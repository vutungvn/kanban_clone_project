'use client';

import { LoaderCircle, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Modal, ModalCloseButton } from '@/components/modal';
import { toast } from '@/components/toast';
import { Alert } from '@/components/ui';
import { WorkspacePage } from '@/components/workspaces/workspace-page';
import { errorMessage } from '@/lib/api';
import { boardsStore } from '@/lib/boards-store';
import { MAX_WORKSPACE_DESCRIPTION, MAX_WORKSPACE_NAME, type Workspace } from '@/lib/workspaces-api';
import { workspacesStore } from '@/lib/workspaces-store';

/** /w/:id/settings — tên, mô tả không gian (quản trị viên sửa được; thành viên chỉ xem) + xoá không gian (quản trị viên). */
export default function WorkspaceSettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  return (
    <WorkspacePage workspaceId={workspaceId}>
      {/* key: tên / mô tả đổi từ nơi khác (realtime) → form lấy lại giá trị mới */}
      {(workspace) => (
        <div className="flex flex-col gap-6">
          <GeneralSettings key={`${workspace.id}:${workspace.name}:${workspace.description}`} workspace={workspace} />
          {workspace.role === 'ADMIN' && <DangerZone workspace={workspace} />}
        </div>
      )}
    </WorkspacePage>
  );
}

function GeneralSettings({ workspace }: { workspace: Workspace }) {
  const isAdmin = workspace.role === 'ADMIN';
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();
  const unchanged = trimmed === workspace.name && description.trim() === workspace.description;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed || unchanged || pending) return;
    setPending(true);
    setError(null);
    try {
      await workspacesStore.update(workspace.id, { name: trimmed, description: description.trim() });
      toast.success('Đã lưu thông tin không gian');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="max-w-xl rounded-xl bg-card p-5 shadow-[0_0_0_1px_var(--color-hairline)] sm:p-6">
      <h2 className="text-base font-semibold text-ink">Thông tin chung</h2>
      <p className="mt-1 text-sm text-ink-subtle">
        {isAdmin ? 'Tên và mô tả hiển thị với mọi thành viên của không gian.' : 'Chỉ quản trị viên của không gian mới sửa được.'}
      </p>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
        <fieldset disabled={!isAdmin} className="flex flex-col gap-4">
          <div>
            <label htmlFor="ws-name" className="mb-1.5 flex justify-between text-xs font-semibold">
              <span>
                Tên không gian <span className="text-danger">*</span>
              </span>
              <span className="font-medium text-ink-subtle">
                {name.length}/{MAX_WORKSPACE_NAME}
              </span>
            </label>
            <input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_WORKSPACE_NAME}
              className="h-9 w-full rounded bg-card px-3 text-sm text-ink shadow-[0_0_0_1px_var(--color-hairline)] outline-none focus:shadow-[0_0_0_2px_var(--color-brand)] disabled:bg-surface-low disabled:text-ink-subtle"
            />
          </div>
          <div>
            <label htmlFor="ws-description" className="mb-1.5 flex justify-between text-xs font-semibold">
              <span>Mô tả</span>
              <span className="font-medium text-ink-subtle">
                {description.length}/{MAX_WORKSPACE_DESCRIPTION}
              </span>
            </label>
            <textarea
              id="ws-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={MAX_WORKSPACE_DESCRIPTION}
              rows={3}
              className="w-full resize-none rounded bg-card px-3 py-2 text-sm text-ink shadow-[0_0_0_1px_var(--color-hairline)] outline-none focus:shadow-[0_0_0_2px_var(--color-brand)] disabled:bg-surface-low disabled:text-ink-subtle"
            />
          </div>
        </fieldset>
        {error && <Alert tone="error">{error}</Alert>}
        {isAdmin && (
          <div>
            <button
              type="submit"
              disabled={!trimmed || unchanged || pending}
              className="inline-flex h-9 items-center gap-2 rounded bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending && <LoaderCircle size={16} className="animate-spin" />}
              {pending ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}

function DangerZone({ workspace }: { workspace: Workspace }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="max-w-xl rounded-xl bg-card p-5 shadow-[0_0_0_1px_var(--color-danger)] sm:p-6">
      <h2 className="text-base font-semibold text-danger">Xoá không gian</h2>
      <p className="mt-1 text-sm text-ink-subtle">
        Xoá vĩnh viễn không gian cùng <strong className="text-ink">{workspace.boardCount} bảng</strong> của nó (kể cả bảng riêng tư bạn không tham gia),
        mọi danh sách, thẻ, tệp đính kèm và hoạt động. Không thể khôi phục. Mẫu bảng của mọi người không bị ảnh hưởng.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex h-9 items-center gap-2 rounded bg-danger px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        <Trash2 size={16} />
        Xoá không gian
      </button>
      {open && <DeleteWorkspaceModal workspace={workspace} onClose={() => setOpen(false)} />}
    </section>
  );
}

/** Gõ lại đúng tên không gian mới bật được nút xoá (server cũng kiểm tra lại). */
function DeleteWorkspaceModal({ workspace, onClose }: { workspace: Workspace; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = name.trim() === workspace.name;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!matches || pending) return;
    setPending(true);
    setError(null);
    try {
      const { deletedBoards } = await workspacesStore.remove(workspace.id, name.trim());
      toast.success(`Đã xoá không gian "${workspace.name}" và ${deletedBoards} bảng`);
      router.replace('/boards');
      void boardsStore.load(true);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Modal label="Xoá không gian" onClose={onClose} className="max-w-md">
      <ModalCloseButton onClick={onClose} />
      <form onSubmit={submit} className="flex flex-col gap-4 p-5 sm:p-6">
        <h2 className="pr-8 text-lg font-semibold">Xoá vĩnh viễn {workspace.name}?</h2>
        <Alert tone="error">
          {workspace.boardCount} bảng của không gian sẽ bị xoá vĩnh viễn, kể cả bảng riêng tư. Mọi thành viên và khách mất quyền truy cập ngay.
        </Alert>
        <div>
          <label htmlFor="confirm-workspace-name" className="mb-1.5 block text-sm text-ink">
            Gõ <strong className="select-all">{workspace.name}</strong> để xác nhận
          </label>
          <input
            id="confirm-workspace-name"
            autoFocus
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 w-full rounded bg-card px-3 text-sm text-ink shadow-[0_0_0_1px_var(--color-hairline)] outline-none focus:shadow-[0_0_0_2px_var(--color-danger)]"
          />
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        <button
          type="submit"
          disabled={!matches || pending}
          className="flex h-9 items-center justify-center gap-2 rounded bg-danger text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending && <LoaderCircle size={16} className="animate-spin" />}
          {pending ? 'Đang xoá...' : 'Xoá vĩnh viễn'}
        </button>
      </form>
    </Modal>
  );
}
