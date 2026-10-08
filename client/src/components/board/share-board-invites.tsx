'use client';

import { Check, Copy, Inbox, Link2, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/avatar';
import { Popover, PopoverHeader, usePopoverAnchor } from '@/components/popover';
import { toast } from '@/components/toast';
import { ApiError, errorMessage } from '@/lib/api';
import {
  inviteLinkApi,
  inviteUrl,
  joinRequestsApi,
  type BoardRole,
  type InviteLink,
  type JoinRequest,
} from '@/lib/boards-api';
import { cn } from '@/lib/cn';
import type { BoardActions } from '@/lib/use-board';

const LINK_ROLES: { value: InviteLink['role']; label: string }[] = [
  { value: 'MEMBER', label: 'Thành viên' },
  { value: 'VIEWER', label: 'Người xem' },
];
const APPROVE_ROLES: { value: BoardRole; label: string }[] = [
  { value: 'ADMIN', label: 'Quản trị viên' },
  ...LINK_ROLES,
];

const SMALL_SELECT =
  'h-8 rounded bg-white px-1.5 text-xs font-medium text-ink shadow-[0_0_0_1px_rgba(9,30,66,0.14)] outline-none focus:shadow-[0_0_0_2px_var(--color-brand)]';
const TEXT_BUTTON = 'rounded px-2 py-1 text-xs font-medium transition-colors';

const RELATIVE = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' });

/** "5 phút trước", "hôm qua"... */
function timeAgo(iso: string) {
  const seconds = (Date.parse(iso) - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return RELATIVE.format(Math.round(seconds / size), unit);
  }
  return 'vừa xong';
}

// ---------- Dữ liệu (chỉ ADMIN mới tải) ----------

export function useInviteLink(boardId: string, enabled: boolean) {
  const [link, setLink] = useState<InviteLink | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    inviteLinkApi
      .get(boardId)
      .then((l) => !cancelled && setLink(l))
      .catch((e) => !cancelled && toast.error(errorMessage(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [boardId, enabled]);

  return { link, setLink, loading };
}

export function useJoinRequests(boardId: string, enabled: boolean) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(enabled);

  const reload = useCallback(() => {
    setLoading(true);
    return joinRequestsApi
      .list(boardId)
      .then(setRequests)
      .catch((e) => toast.error(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [boardId]);

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);

  const remove = (userId: string) => setRequests((list) => list.filter((r) => r.user.id !== userId));
  return { requests, loading, reload, remove };
}

// ---------- Liên kết mời ----------

type LinkState = ReturnType<typeof useInviteLink>;

/** ADMIN: tạo / sao chép / đổi cài đặt / tạo lại / tắt liên kết. Người khác chỉ thấy dòng giải thích. */
export function InviteLinkSection({ boardId, isAdmin, state }: { boardId: string; isAdmin: boolean; state: LinkState }) {
  const { link, setLink, loading } = state;
  const [busy, setBusy] = useState(false);

  if (!isAdmin) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-lg bg-surface-low px-3 py-3 text-sm text-ink-subtle">
        <Link2 size={18} className="shrink-0" aria-hidden />
        Chỉ quản trị viên mới tạo được liên kết mời.
      </div>
    );
  }

  async function create() {
    setBusy(true);
    try {
      setLink(await inviteLinkApi.create(boardId, { role: 'MEMBER', requiresApproval: false }));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !link) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-lg bg-surface-low px-3 py-3 text-sm">
        <Link2 size={18} className="shrink-0 text-ink-subtle" aria-hidden />
        <span className="flex-1">Chia sẻ bảng này bằng liên kết</span>
        <button
          type="button"
          onClick={() => void create()}
          disabled={loading || busy}
          className="font-semibold text-brand transition-colors hover:text-brand-hover hover:underline disabled:cursor-wait disabled:opacity-50"
        >
          {loading ? 'Đang tải...' : busy ? 'Đang tạo...' : 'Tạo liên kết'}
        </button>
      </div>
    );
  }

  return <ActiveLink boardId={boardId} link={link} setLink={setLink} />;
}

function ActiveLink({
  boardId,
  link,
  setLink,
}: {
  boardId: string;
  link: InviteLink;
  setLink: (link: InviteLink | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const regenerate = usePopoverAnchor();
  const disable = usePopoverAnchor();
  const url = inviteUrl(link.token);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Đã sao chép liên kết');
    } catch {
      // Trình duyệt chặn clipboard → bôi đen sẵn để người dùng tự copy
      inputRef.current?.select();
      toast.error('Không sao chép tự động được — hãy nhấn Ctrl + C');
    }
  }

  /** Đổi cài đặt: cập nhật ngay, lỗi thì trả lại. Token giữ nguyên. */
  async function update(patch: Partial<Omit<InviteLink, 'token'>>) {
    const previous = link;
    setLink({ ...link, ...patch });
    try {
      setLink(await inviteLinkApi.update(boardId, patch));
    } catch (e) {
      setLink(previous);
      toast.error(errorMessage(e));
    }
  }

  async function runRegenerate() {
    regenerate.close();
    try {
      setLink(await inviteLinkApi.create(boardId, { role: link.role, requiresApproval: link.requiresApproval }));
      toast.success('Đã tạo liên kết mới — liên kết cũ không còn dùng được');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function runDisable() {
    disable.close();
    try {
      await inviteLinkApi.disable(boardId);
      setLink(null);
      toast.success('Đã tắt liên kết mời');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <section aria-label="Liên kết mời" className="mt-4 rounded-lg bg-surface-low p-3">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Link2 size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <input
            ref={inputRef}
            readOnly
            value={url}
            aria-label="Đường dẫn liên kết mời"
            onFocus={(e) => e.currentTarget.select()}
            className="h-9 w-full truncate rounded bg-white pr-2 pl-8 text-xs text-ink shadow-[0_0_0_1px_rgba(9,30,66,0.14)] outline-none focus:shadow-[0_0_0_2px_var(--color-brand)]"
          />
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded bg-brand px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-hover"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Đã sao chép' : 'Sao chép'}
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-subtle">
        <label className="flex items-center gap-1.5">
          Người vào bằng link là
          <select
            value={link.role}
            onChange={(e) => void update({ role: e.target.value as InviteLink['role'] })}
            className={SMALL_SELECT}
          >
            {LINK_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={link.requiresApproval}
            onChange={(e) => void update({ requiresApproval: e.target.checked })}
            className="h-4 w-4 accent-brand"
          />
          Cần quản trị viên duyệt
        </label>
        <span className="flex-1" />
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={regenerate.toggle}
            aria-haspopup="dialog"
            aria-expanded={!!regenerate.anchor}
            className={cn(TEXT_BUTTON, 'flex items-center gap-1 text-ink hover:bg-surface-mid')}
          >
            <RefreshCw size={13} />
            Tạo liên kết mới
          </button>
          <button
            type="button"
            onClick={disable.toggle}
            aria-haspopup="dialog"
            aria-expanded={!!disable.anchor}
            className={cn(TEXT_BUTTON, 'text-danger hover:bg-danger-soft/40')}
          >
            Tắt liên kết
          </button>
        </span>
      </div>

      <ConfirmPopover
        anchor={regenerate.anchor}
        onClose={regenerate.close}
        title="Tạo liên kết mới?"
        text="Liên kết hiện tại sẽ không dùng được nữa. Người đã vào bảng không bị ảnh hưởng."
        button="Tạo liên kết mới"
        onConfirm={() => void runRegenerate()}
        tone="brand"
      />
      <ConfirmPopover
        anchor={disable.anchor}
        onClose={disable.close}
        title="Tắt liên kết?"
        text="Không ai vào được bảng bằng liên kết này nữa. Yêu cầu đang chờ vẫn được giữ để bạn duyệt."
        button="Tắt liên kết"
        onConfirm={() => void runDisable()}
      />
    </section>
  );
}

function ConfirmPopover({
  anchor,
  onClose,
  title,
  text,
  button,
  onConfirm,
  tone = 'danger',
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  title: string;
  text: string;
  button: string;
  onConfirm: () => void;
  tone?: 'danger' | 'brand';
}) {
  return (
    <Popover anchor={anchor} onClose={onClose} label={title} align="end" width={280}>
      <PopoverHeader title={title} onClose={onClose} />
      <p className="px-1 text-sm text-ink-subtle">{text}</p>
      <button
        type="button"
        onClick={onConfirm}
        className={cn(
          'mt-3 h-9 w-full rounded text-sm font-medium text-white transition-colors',
          tone === 'danger' ? 'bg-danger hover:opacity-90' : 'bg-brand hover:bg-brand-hover',
        )}
      >
        {button}
      </button>
    </Popover>
  );
}

// ---------- Yêu cầu tham gia ----------

type RequestsState = ReturnType<typeof useJoinRequests>;

export function JoinRequestsList({
  boardId,
  state,
  defaultRole,
  actions,
}: {
  boardId: string;
  state: RequestsState;
  /** Vai trò chọn sẵn khi duyệt = vai trò của liên kết */
  defaultRole: BoardRole;
  actions: BoardActions;
}) {
  const { requests, loading } = state;

  if (loading && requests.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-subtle">Đang tải...</p>;
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-8 text-center">
        <Inbox size={28} className="text-outline" aria-hidden />
        <p className="text-sm font-medium">Chưa có yêu cầu nào</p>
        <p className="max-w-80 text-xs text-ink-subtle">
          Bật &quot;Cần quản trị viên duyệt&quot; cho liên kết mời để người mở link phải gửi yêu cầu trước khi vào bảng.
        </p>
      </div>
    );
  }

  return (
    <ul className="-mx-2 mt-2 max-h-[50vh] overflow-y-auto px-2">
      {requests.map((r) => (
        <RequestRow key={r.user.id} boardId={boardId} request={r} defaultRole={defaultRole} state={state} actions={actions} />
      ))}
    </ul>
  );
}

function RequestRow({
  boardId,
  request,
  defaultRole,
  state,
  actions,
}: {
  boardId: string;
  request: JoinRequest;
  defaultRole: BoardRole;
  state: RequestsState;
  actions: BoardActions;
}) {
  const { user } = request;
  const [role, setRole] = useState<BoardRole>(defaultRole);
  const [busy, setBusy] = useState(false);
  const reject = usePopoverAnchor();

  /** ADMIN khác vừa xử lý trước → báo lỗi và tải lại danh sách cho khớp. */
  function handleStale(e: unknown) {
    toast.error(errorMessage(e));
    if (e instanceof ApiError && (e.status === 404 || e.status === 409)) void state.reload();
  }

  async function approve() {
    setBusy(true);
    try {
      await actions.approveJoinRequest(user.id, role);
      state.remove(user.id);
      toast.success(`Đã thêm ${user.name} vào bảng`);
    } catch (e) {
      handleStale(e);
      setBusy(false);
    }
  }

  async function runReject() {
    reject.close();
    setBusy(true);
    try {
      await joinRequestsApi.reject(boardId, user.id);
      state.remove(user.id);
      toast.success(`Đã từ chối yêu cầu của ${user.name}`);
    } catch (e) {
      handleStale(e);
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-surface-low py-3 last:border-0">
      <Avatar name={user.name} seed={user.id} size={36} />
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate text-sm font-semibold">{user.name}</p>
        <p className="truncate text-xs text-ink-subtle">
          {user.email} · <time dateTime={request.createdAt}>{timeAgo(request.createdAt)}</time>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as BoardRole)}
          aria-label={`Vai trò khi duyệt ${user.name}`}
          disabled={busy}
          className={SMALL_SELECT}
        >
          {APPROVE_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void approve()}
          disabled={busy}
          className="h-8 rounded bg-brand px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          Duyệt
        </button>
        <button
          type="button"
          onClick={reject.toggle}
          disabled={busy}
          aria-haspopup="dialog"
          aria-expanded={!!reject.anchor}
          aria-label={`Từ chối ${user.name}`}
          title="Từ chối"
          className="flex h-8 w-8 items-center justify-center rounded text-ink-subtle transition-colors hover:bg-danger-soft/40 hover:text-danger aria-expanded:bg-danger-soft/40"
        >
          <X size={16} />
        </button>
      </div>
      <ConfirmPopover
        anchor={reject.anchor}
        onClose={reject.close}
        title="Từ chối yêu cầu?"
        text={`${user.name} sẽ không vào được bảng. Họ vẫn có thể gửi lại yêu cầu bằng liên kết.`}
        button="Từ chối"
        onConfirm={() => void runReject()}
      />
    </li>
  );
}
