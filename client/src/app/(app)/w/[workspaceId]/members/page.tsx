'use client';

import { Check, ChevronDown, LoaderCircle, LogOut, UserMinus, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Avatar } from '@/components/avatar';
import { Modal, ModalCloseButton } from '@/components/modal';
import { Popover, PopoverHeader, usePopoverAnchor } from '@/components/popover';
import { toast } from '@/components/toast';
import { Alert } from '@/components/ui';
import { WorkspacePage } from '@/components/workspaces/workspace-page';
import { errorMessage } from '@/lib/api';
import { boardsStore } from '@/lib/boards-store';
import { formatDay } from '@/lib/card-dates';
import { cn } from '@/lib/cn';
import { getSocket } from '@/lib/realtime';
import {
  WORKSPACE_ROLE_LABEL,
  workspaceMembersApi,
  type Workspace,
  type WorkspaceGuest,
  type WorkspaceMember,
  type WorkspaceRole,
} from '@/lib/workspaces-api';
import { workspacesStore } from '@/lib/workspaces-store';

const ROLES: { value: WorkspaceRole; description: string }[] = [
  { value: 'ADMIN', description: 'Mời / xoá thành viên, đổi vai trò, sửa cài đặt không gian' },
  { value: 'MEMBER', description: 'Xem không gian, tạo bảng trong không gian' },
];

type Tab = 'members' | 'guests';

/** /w/:id/members — thành viên + khách của không gian. Quản trị viên mời, đổi vai trò, xoá; ai cũng tự rời được. */
export default function WorkspaceMembersPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  return <WorkspacePage workspaceId={workspaceId}>{(workspace) => <Members workspace={workspace} />}</WorkspacePage>;
}

function Members({ workspace }: { workspace: Workspace }) {
  const { user } = useAuth();
  const [data, setData] = useState<{ members: WorkspaceMember[]; guests: WorkspaceGuest[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('members');
  const isAdmin = workspace.role === 'ADMIN';

  const load = useCallback(() => {
    workspaceMembersApi.list(workspace.id).then(
      (d) => {
        setData(d);
        setError(null);
      },
      (e) => setError(errorMessage(e)),
    );
  }, [workspace.id]);
  useEffect(load, [load]);

  // Quản trị viên khác vừa mời / xoá / đổi vai trò → tải lại
  useEffect(() => {
    const socket = getSocket();
    socket.on('workspaces:changed', load);
    return () => {
      socket.off('workspaces:changed', load);
    };
  }, [load]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data || !user) {
    return (
      <p className="flex items-center justify-center gap-2 py-12 text-sm text-ink-subtle">
        <LoaderCircle size={16} className="animate-spin" />
        Đang tải thành viên...
      </p>
    );
  }
  const adminCount = data.members.filter((m) => m.role === 'ADMIN').length;

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      {isAdmin && <InviteForm workspace={workspace} onInvited={load} />}

      <div role="tablist" aria-label="Thành viên và khách" className="flex gap-6 border-b border-surface-high text-sm font-medium">
        {(['members', 'guests'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn('-mb-px border-b-2 pb-2 transition-colors', tab === t ? 'border-brand text-brand' : 'border-transparent text-ink-subtle hover:text-ink')}
          >
            {t === 'members' ? 'Thành viên' : 'Khách'}
            <span className="ml-1.5 rounded-full bg-surface-mid px-1.5 text-xs text-ink-subtle">
              {t === 'members' ? data.members.length : data.guests.length}
            </span>
          </button>
        ))}
      </div>

      {tab === 'members' ? (
        <ul className="rounded-xl bg-card px-4 shadow-[0_0_0_1px_var(--color-hairline)]">
          {data.members.map((m) => (
            <MemberRow
              key={m.id}
              workspace={workspace}
              member={m}
              isMe={m.id === user.id}
              canManage={isAdmin}
              lastAdmin={m.role === 'ADMIN' && adminCount === 1}
              onChanged={load}
            />
          ))}
        </ul>
      ) : data.guests.length ? (
        <>
          <p className="text-sm text-ink-subtle">
            Khách là người ở trong bảng của không gian nhưng không thuộc không gian. Chỉ hiện các bảng bạn cũng tham gia.
          </p>
          <ul className="rounded-xl bg-card px-4 shadow-[0_0_0_1px_var(--color-hairline)]">
            {data.guests.map((g) => (
              <GuestRow key={g.id} workspace={workspace} guest={g} canManage={isAdmin} onAdded={load} />
            ))}
          </ul>
        </>
      ) : (
        <p className="rounded-xl bg-surface-low px-4 py-8 text-center text-sm text-ink-subtle">Không có khách nào trong các bảng bạn tham gia.</p>
      )}
    </div>
  );
}

function InviteForm({ workspace, onInvited }: { workspace: Workspace; onInvited: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('MEMBER');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value || pending) return;
    setPending(true);
    setError(null);
    try {
      const member = await workspaceMembersApi.invite(workspace.id, value, role);
      toast.success(`Đã thêm ${member.name} vào không gian`);
      setEmail('');
      onInvited();
      void workspacesStore.load(true); // số thành viên
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl bg-card p-4 shadow-[0_0_0_1px_var(--color-hairline)]">
      <label htmlFor="ws-invite-email" className="mb-1.5 block text-sm font-semibold text-ink">
        Mời thành viên
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="ws-invite-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          placeholder="Email của tài khoản đã đăng ký"
          aria-invalid={!!error}
          aria-describedby={error ? 'ws-invite-error' : undefined}
          className="h-9 min-w-56 flex-1 rounded bg-card px-3 text-sm text-ink shadow-[0_0_0_1px_var(--color-hairline)] outline-none placeholder:text-outline focus:shadow-[0_0_0_2px_var(--color-brand)]"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as WorkspaceRole)}
          aria-label="Vai trò"
          className="h-9 rounded bg-card px-2 text-sm text-ink shadow-[0_0_0_1px_var(--color-hairline)] outline-none focus:shadow-[0_0_0_2px_var(--color-brand)]"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {WORKSPACE_ROLE_LABEL[r.value]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!email.trim() || pending}
          className="inline-flex h-9 items-center gap-2 rounded bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? <LoaderCircle size={16} className="animate-spin" /> : <UserPlus size={16} />}
          Mời
        </button>
      </div>
      {error && (
        <p id="ws-invite-error" role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}
      <p className="mt-2 text-xs text-ink-subtle">Người được mời vào ngay và nhận thông báo. Quyền trong từng bảng không thay đổi.</p>
    </form>
  );
}

type Confirm = { kind: 'remove' } | { kind: 'leave' } | { kind: 'demote-self' } | null;

function MemberRow({
  workspace,
  member,
  isMe,
  canManage,
  lastAdmin,
  onChanged,
}: {
  workspace: Workspace;
  member: WorkspaceMember;
  isMe: boolean;
  canManage: boolean;
  lastAdmin: boolean;
  onChanged: () => void;
}) {
  const menu = usePopoverAnchor();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [pending, setPending] = useState(false);
  // Quản trị viên mở được menu của mọi người; thành viên chỉ mở menu của chính mình (để rời)
  const hasMenu = canManage || isMe;

  async function changeRole(role: WorkspaceRole) {
    menu.close();
    if (role === member.role) return;
    if (isMe && member.role === 'ADMIN') return setConfirm({ kind: 'demote-self' });
    await applyRole(role);
  }

  async function applyRole(role: WorkspaceRole) {
    setPending(true);
    try {
      await workspaceMembersApi.updateRole(workspace.id, member.id, role);
      toast.success(`Đã đổi vai trò của ${member.name} thành ${WORKSPACE_ROLE_LABEL[role].toLowerCase()}`);
      onChanged();
      if (isMe) void workspacesStore.load(true);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPending(false);
      setConfirm(null);
    }
  }

  return (
    <li className="flex items-center gap-3 border-b border-surface-low py-3 last:border-0">
      <Avatar name={member.name} seed={member.id} src={member.avatarUrl} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {member.name}
          {isMe && <span className="ml-1 text-xs font-normal text-ink-subtle">(bạn)</span>}
        </p>
        <p className="truncate text-xs text-ink-subtle">
          {member.email} · Tham gia {formatDay(member.joinedAt)}
        </p>
      </div>
      {hasMenu ? (
        <button
          type="button"
          onClick={menu.toggle}
          disabled={pending}
          aria-haspopup="dialog"
          aria-expanded={!!menu.anchor}
          aria-label={`Vai trò của ${member.name}: ${WORKSPACE_ROLE_LABEL[member.role]}`}
          className="group flex h-8 shrink-0 items-center gap-1 rounded bg-surface-low px-2.5 text-xs font-medium transition-colors hover:bg-surface-mid aria-expanded:bg-card aria-expanded:text-brand aria-expanded:ring-1 aria-expanded:ring-brand disabled:opacity-60"
        >
          {WORKSPACE_ROLE_LABEL[member.role]}
          <ChevronDown size={14} className="transition-transform group-aria-expanded:rotate-180" />
        </button>
      ) : (
        <span className="shrink-0 px-2.5 text-xs font-medium text-ink-subtle">{WORKSPACE_ROLE_LABEL[member.role]}</span>
      )}

      <Popover anchor={menu.anchor} onClose={menu.close} label={`Vai trò của ${member.name}`} align="end" width={280}>
        <PopoverHeader title="Vai trò trong không gian" onClose={menu.close} />
        {canManage &&
          ROLES.map((r) => {
            const disabled = lastAdmin && r.value !== 'ADMIN';
            return (
              <button
                key={r.value}
                type="button"
                disabled={disabled}
                onClick={() => void changeRole(r.value)}
                className="flex w-full items-start gap-2 rounded px-2 py-2 text-left transition-colors hover:bg-surface-low disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{WORKSPACE_ROLE_LABEL[r.value]}</span>
                  <span className="block text-xs text-ink-subtle">{r.description}</span>
                </span>
                {member.role === r.value && <Check size={16} className="mt-0.5 shrink-0 text-brand" />}
              </button>
            );
          })}
        {lastAdmin && <p className="px-2 pt-1 text-xs text-ink-subtle">Không gian cần ít nhất một quản trị viên.</p>}
        <hr className="-mx-3 my-2 border-surface-high" />
        {isMe ? (
          <button
            type="button"
            disabled={lastAdmin}
            onClick={() => {
              menu.close();
              setConfirm({ kind: 'leave' });
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm text-danger transition-colors hover:bg-danger-soft/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogOut size={16} />
            Rời không gian
          </button>
        ) : (
          <button
            type="button"
            disabled={lastAdmin}
            onClick={() => {
              menu.close();
              setConfirm({ kind: 'remove' });
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm text-danger transition-colors hover:bg-danger-soft/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserMinus size={16} />
            Xoá khỏi không gian
          </button>
        )}
      </Popover>

      {confirm?.kind === 'remove' && (
        <RemoveMemberModal workspace={workspace} member={member} onClose={() => setConfirm(null)} onRemoved={onChanged} />
      )}
      {confirm?.kind === 'leave' && <LeaveModal workspace={workspace} userId={member.id} onClose={() => setConfirm(null)} />}
      {confirm?.kind === 'demote-self' && (
        <Modal label="Bỏ quyền quản trị" onClose={() => setConfirm(null)} className="max-w-md">
          <ModalCloseButton onClick={() => setConfirm(null)} />
          <div className="flex flex-col gap-4 p-5 sm:p-6">
            <h2 className="pr-8 text-lg font-semibold">Bỏ quyền quản trị của bạn?</h2>
            <p className="text-sm text-ink-subtle">
              Bạn sẽ không còn mời / xoá thành viên hay sửa cài đặt của <strong className="text-ink">{workspace.name}</strong>. Chỉ quản trị viên
              khác mới cấp lại được.
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={() => void applyRole('MEMBER')}
              className="h-9 rounded bg-danger text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {pending ? 'Đang đổi...' : 'Bỏ quyền quản trị'}
            </button>
          </div>
        </Modal>
      )}
    </li>
  );
}

/** Xoá người khác: chọn "chỉ khỏi không gian" (thành khách) hoặc "cả các bảng của không gian". */
function RemoveMemberModal({
  workspace,
  member,
  onClose,
  onRemoved,
}: {
  workspace: Workspace;
  member: WorkspaceMember;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const [fromBoards, setFromBoards] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const { removedFromBoards } = await workspaceMembersApi.remove(workspace.id, member.id, fromBoards);
      toast.success(
        removedFromBoards
          ? `Đã xoá ${member.name} khỏi không gian và ${removedFromBoards} bảng`
          : `Đã xoá ${member.name} khỏi không gian`,
      );
      onClose();
      onRemoved();
      void workspacesStore.load(true);
      // Có thể vừa được đặt làm quản trị viên của bảng họ quản trị duy nhất
      if (removedFromBoards) void boardsStore.load(true);
    } catch (e) {
      setError(errorMessage(e));
      setPending(false);
    }
  }

  const options = [
    { value: false, title: 'Chỉ xoá khỏi không gian', description: 'Vẫn ở các bảng đang tham gia, trở thành khách của không gian.' },
    {
      value: true,
      title: 'Xoá khỏi không gian và mọi bảng của không gian',
      description: 'Gỡ khỏi các bảng và thẻ được giao. Bảng nào họ là quản trị viên duy nhất → bạn trở thành quản trị viên của bảng đó.',
    },
  ];

  return (
    <Modal label={`Xoá ${member.name}`} onClose={onClose} className="max-w-md">
      <ModalCloseButton onClick={onClose} />
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <h2 className="pr-8 text-lg font-semibold">
          Xoá {member.name} khỏi {workspace.name}?
        </h2>
        <div role="radiogroup" aria-label="Phạm vi xoá" className="flex flex-col gap-2">
          {options.map((o) => (
            <label
              key={String(o.value)}
              className={cn(
                'flex cursor-pointer gap-3 rounded-lg p-3 transition-shadow',
                fromBoards === o.value ? 'shadow-[0_0_0_2px_var(--color-brand)]' : 'shadow-[0_0_0_1px_var(--color-hairline)]',
              )}
            >
              <input type="radio" name="from-boards" checked={fromBoards === o.value} onChange={() => setFromBoards(o.value)} className="mt-0.5 accent-brand" />
              <span>
                <span className="block text-sm font-medium text-ink">{o.title}</span>
                <span className="block text-xs text-ink-subtle">{o.description}</span>
              </span>
            </label>
          ))}
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        <button
          type="button"
          disabled={pending}
          onClick={() => void submit()}
          className="h-9 rounded bg-danger text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? 'Đang xoá...' : 'Xoá'}
        </button>
      </div>
    </Modal>
  );
}

/** Tự rời không gian: vẫn ở các bảng đang tham gia (thành khách). Rời xong về trang Bảng. */
function LeaveModal({ workspace, userId, onClose }: { workspace: Workspace; userId: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function leave() {
    setPending(true);
    setError(null);
    try {
      await workspaceMembersApi.remove(workspace.id, userId);
      toast.success(`Đã rời không gian "${workspace.name}"`);
      // Rời trang trước, rồi mới tải lại — tránh nháy "Không tìm thấy không gian"
      router.replace('/boards');
      void workspacesStore.load(true);
    } catch (e) {
      setError(errorMessage(e));
      setPending(false);
    }
  }

  return (
    <Modal label="Rời không gian" onClose={onClose} className="max-w-md">
      <ModalCloseButton onClick={onClose} />
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <h2 className="pr-8 text-lg font-semibold">Rời {workspace.name}?</h2>
        <p className="text-sm text-ink-subtle">
          Bạn vẫn ở trong các bảng đang tham gia (với tư cách khách), nhưng không còn thấy không gian này. Muốn quay lại cần quản trị viên mời lại.
        </p>
        {error && <Alert tone="error">{error}</Alert>}
        <button
          type="button"
          disabled={pending}
          onClick={() => void leave()}
          className="h-9 rounded bg-danger text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? 'Đang rời...' : 'Rời không gian'}
        </button>
      </div>
    </Modal>
  );
}

function GuestRow({ workspace, guest, canManage, onAdded }: { workspace: Workspace; guest: WorkspaceGuest; canManage: boolean; onAdded: () => void }) {
  const [pending, setPending] = useState(false);

  async function addToWorkspace() {
    setPending(true);
    try {
      await workspaceMembersApi.invite(workspace.id, guest.email, 'MEMBER');
      toast.success(`Đã thêm ${guest.name} vào không gian`);
      onAdded();
      void workspacesStore.load(true);
    } catch (e) {
      toast.error(errorMessage(e));
      setPending(false);
    }
  }

  return (
    <li className="flex items-start gap-3 border-b border-surface-low py-3 last:border-0">
      <Avatar name={guest.name} seed={guest.id} src={guest.avatarUrl} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{guest.name}</p>
        <p className="truncate text-xs text-ink-subtle">{guest.email}</p>
        <p className="mt-1 flex flex-wrap gap-1 text-xs">
          {guest.boards.map((b) => (
            <Link key={b.id} href={`/b/${b.id}`} className="rounded bg-surface-low px-1.5 py-0.5 text-ink-subtle transition-colors hover:bg-surface-mid hover:text-ink">
              {b.title}
            </Link>
          ))}
        </p>
      </div>
      {canManage && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void addToWorkspace()}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded bg-surface-low px-2.5 text-xs font-medium text-ink transition-colors hover:bg-surface-mid disabled:opacity-60"
        >
          {pending ? <LoaderCircle size={14} className="animate-spin" /> : <UserPlus size={14} />}
          Thêm vào không gian
        </button>
      )}
    </li>
  );
}
