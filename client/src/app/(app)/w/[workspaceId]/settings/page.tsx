'use client';

import { LoaderCircle } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { toast } from '@/components/toast';
import { Alert } from '@/components/ui';
import { WorkspacePage } from '@/components/workspaces/workspace-page';
import { errorMessage } from '@/lib/api';
import { MAX_WORKSPACE_DESCRIPTION, MAX_WORKSPACE_NAME, type Workspace } from '@/lib/workspaces-api';
import { workspacesStore } from '@/lib/workspaces-store';

/** /w/:id/settings — tên, mô tả không gian. Quản trị viên sửa được; thành viên chỉ xem. */
export default function WorkspaceSettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  return (
    <WorkspacePage workspaceId={workspaceId}>
      {/* key: tên / mô tả đổi từ nơi khác (realtime) → form lấy lại giá trị mới */}
      {(workspace) => <GeneralSettings key={`${workspace.id}:${workspace.name}:${workspace.description}`} workspace={workspace} />}
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
