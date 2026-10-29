'use client';

import type { Workspace } from '@/lib/workspaces-api';

/** Ô chọn không gian cho bảng mới (form tạo bảng, tạo bảng từ mẫu). */
export function WorkspaceSelect({
  id,
  workspaces,
  value,
  onChange,
}: {
  id: string;
  workspaces: Workspace[];
  value: string;
  onChange: (workspaceId: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold">
        Không gian làm việc
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!workspaces.length}
        className="h-9 w-full rounded bg-card px-2 text-sm text-ink shadow-[0_0_0_1px_var(--color-hairline)] outline-none focus:shadow-[0_0_0_2px_var(--color-brand)]"
      >
        {!workspaces.length && <option value="">Đang tải...</option>}
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Không gian chọn sẵn: `preferred` nếu mình thuộc nó, không thì không gian đầu tiên. */
export const defaultWorkspaceId = (workspaces: Workspace[], preferred?: string | null) =>
  (preferred && workspaces.some((w) => w.id === preferred) ? preferred : workspaces[0]?.id) ?? '';
