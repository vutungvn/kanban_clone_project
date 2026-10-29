'use client';

import { LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Modal, ModalCloseButton } from '@/components/modal';
import { toast } from '@/components/toast';
import { Alert } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { MAX_WORKSPACE_DESCRIPTION, MAX_WORKSPACE_NAME } from '@/lib/workspaces-api';
import { workspacesStore } from '@/lib/workspaces-store';
import { WorkspaceLogo } from './workspace-logo';

/** Tạo không gian làm việc mới (mình là quản trị viên) rồi mở trang của không gian đó. */
export function CreateWorkspaceModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed || pending) return;
    setPending(true);
    setError(null);
    try {
      const workspace = await workspacesStore.create({ name: trimmed, description: description.trim() });
      toast.success(`Đã tạo không gian "${workspace.name}"`);
      onClose();
      router.push(`/w/${workspace.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Modal label="Tạo không gian làm việc" onClose={onClose} className="max-w-md">
      <ModalCloseButton onClick={onClose} />
      <form onSubmit={submit} className="flex flex-col gap-4 p-5 sm:p-6">
        <header className="flex items-center gap-3 pr-8">
          <WorkspaceLogo workspace={{ id: trimmed || 'new', name: trimmed || '?' }} size={40} />
          <div>
            <h2 className="text-lg font-semibold text-ink">Tạo không gian làm việc</h2>
            <p className="text-sm text-ink-subtle">Nhóm các bảng của một đội, dự án hoặc công ty.</p>
          </div>
        </header>

        <div>
          <label htmlFor="workspace-name" className="mb-1.5 flex justify-between text-xs font-semibold">
            <span>
              Tên không gian <span className="text-danger">*</span>
            </span>
            <span className="font-medium text-ink-subtle">
              {name.length}/{MAX_WORKSPACE_NAME}
            </span>
          </label>
          <input
            id="workspace-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_WORKSPACE_NAME}
            placeholder="vd: Đội Marketing"
            className="h-9 w-full rounded bg-card px-3 text-sm text-ink shadow-[0_0_0_1px_var(--color-hairline)] outline-none placeholder:text-outline focus:shadow-[0_0_0_2px_var(--color-brand)]"
          />
        </div>

        <div>
          <label htmlFor="workspace-description" className="mb-1.5 flex justify-between text-xs font-semibold">
            <span>Mô tả</span>
            <span className="font-medium text-ink-subtle">
              {description.length}/{MAX_WORKSPACE_DESCRIPTION}
            </span>
          </label>
          <textarea
            id="workspace-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={MAX_WORKSPACE_DESCRIPTION}
            rows={3}
            placeholder="Không gian này dùng cho việc gì?"
            className="w-full resize-none rounded bg-card px-3 py-2 text-sm text-ink shadow-[0_0_0_1px_var(--color-hairline)] outline-none placeholder:text-outline focus:shadow-[0_0_0_2px_var(--color-brand)]"
          />
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <button
          type="submit"
          disabled={!trimmed || pending}
          className="flex h-9 items-center justify-center gap-2 rounded bg-brand text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-surface-mid disabled:text-outline"
        >
          {pending && <LoaderCircle size={16} className="animate-spin" />}
          {pending ? 'Đang tạo...' : 'Tạo không gian'}
        </button>
      </form>
    </Modal>
  );
}
