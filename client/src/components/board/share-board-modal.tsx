'use client';

import { Check, ChevronDown, LogOut, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Avatar } from '@/components/avatar';
import { Modal, ModalCloseButton } from '@/components/modal';
import { Popover, PopoverHeader, usePopoverAnchor } from '@/components/popover';
import { toast } from '@/components/toast';
import { errorMessage } from '@/lib/api';
import type { BoardDetail, BoardMember, BoardRole } from '@/lib/boards-api';
import { cn } from '@/lib/cn';
import type { BoardActions } from '@/lib/use-board';
import { InviteLinkSection, JoinRequestsList, useInviteLink, useJoinRequests } from './share-board-invites';

const ROLES: { value: BoardRole; label: string; description: string }[] = [
  { value: 'ADMIN', label: 'Quản trị viên', description: 'Toàn quyền, quản lý thành viên' },
  { value: 'MEMBER', label: 'Thành viên', description: 'Thêm, sửa danh sách và thẻ' },
  { value: 'VIEWER', label: 'Người xem', description: 'Chỉ xem bảng' },
];
const roleLabel = (role: BoardRole) => ROLES.find((r) => r.value === role)?.label ?? role;

const FIELD = 'h-10 rounded bg-card text-sm text-ink outline-none transition-shadow';
const FIELD_RING = 'shadow-[0_0_0_1px_var(--color-hairline)] focus:shadow-[0_0_0_2px_var(--color-brand)]';
const MENU_ITEM = 'flex w-full items-start gap-2 rounded px-2.5 py-2 text-left text-sm transition-colors';

type Tab = 'members' | 'requests';

/**
 * Modal "Chia sẻ bảng": ADMIN mời / đổi vai trò / xoá, quản lý liên kết mời và duyệt yêu cầu tham gia;
 * mọi người xem danh sách thành viên và tự rời bảng.
 */
export function ShareBoardModal({
  board,
  actions,
  onClose,
}: {
  board: BoardDetail;
  actions: BoardActions;
  onClose: () => void;
}) {
  const meId = useAuth().user?.id;
  const isAdmin = board.role === 'ADMIN';
  const adminCount = board.members.filter((m) => m.role === 'ADMIN').length;
  const link = useInviteLink(board.id, isAdmin);
  const requests = useJoinRequests(board.id, isAdmin);
  const [selected, setSelected] = useState<Tab>('members');
  // Tự hạ quyền khi đang ở tab yêu cầu → quay về tab thành viên
  const tab: Tab = isAdmin ? selected : 'members';

  return (
    <Modal label="Chia sẻ bảng" onClose={onClose} className="max-w-146 p-6">
      <ModalCloseButton onClick={onClose} />
      <h2 className="mb-5 pr-10 text-xl font-semibold">Chia sẻ bảng</h2>

      {isAdmin && <InviteForm actions={actions} />}
      <InviteLinkSection boardId={board.id} isAdmin={isAdmin} state={link} />

      <div role="tablist" aria-label="Thành viên và yêu cầu" className="mt-5 flex gap-4 border-b border-surface-high text-sm font-medium whitespace-nowrap sm:gap-6">
        <TabButton active={tab === 'members'} onClick={() => setSelected('members')}>
          Thành viên<span className="hidden sm:inline">&nbsp;của bảng</span>&nbsp;({board.members.length})
        </TabButton>
        {isAdmin && (
          <TabButton active={tab === 'requests'} onClick={() => setSelected('requests')}>
            Yêu cầu<span className="hidden sm:inline">&nbsp;tham gia</span>
            {requests.requests.length > 0 && (
              <span className="ml-1.5 rounded-full bg-danger px-1.5 py-px text-[11px] font-semibold text-white">
                {requests.requests.length}
              </span>
            )}
          </TabButton>
        )}
      </div>

      {tab === 'members' ? (
        <ul className="-mx-2 mt-2 max-h-[50vh] overflow-y-auto px-2">
          {board.members.map((member) => (
            <MemberRow
              key={member.id}
              board={board}
              member={member}
              isMe={member.id === meId}
              canManage={isAdmin}
              lastAdmin={member.role === 'ADMIN' && adminCount === 1}
              actions={actions}
            />
          ))}
        </ul>
      ) : (
        <JoinRequestsList boardId={board.id} state={requests} defaultRole={link.link?.role ?? 'MEMBER'} actions={actions} />
      )}

      {!isAdmin && (
        <p className="mt-3 text-xs text-ink-subtle">Chỉ quản trị viên của bảng mới có thể mời hoặc thay đổi thành viên.</p>
      )}
    </Modal>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        '-mb-px flex items-center border-b-2 pb-2 transition-colors',
        active ? 'border-brand font-semibold text-brand' : 'border-transparent text-ink-subtle hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

function InviteForm({ actions }: { actions: BoardActions }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<BoardRole>('MEMBER');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) {
      setError('Vui lòng nhập email');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const member = await actions.inviteMember(value, role);
      setEmail('');
      setRole('MEMBER'); // tránh vô tình cấp quyền quản trị cho người mời tiếp theo
      toast.success(`Đã thêm ${member.name} vào bảng`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <form noValidate onSubmit={submit}>
      <div className="flex flex-wrap gap-2">
        <input
          type="email"
          autoFocus
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          placeholder="Địa chỉ email"
          aria-label="Email người muốn mời"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'invite-error' : undefined}
          className={cn(
            FIELD,
            'min-w-0 flex-1 basis-56 px-3 placeholder:text-outline',
            error ? 'shadow-[0_0_0_1.5px_var(--color-danger)] focus:shadow-[0_0_0_2px_var(--color-danger)]' : FIELD_RING,
          )}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as BoardRole)}
          aria-label="Vai trò"
          className={cn(FIELD, FIELD_RING, 'bg-surface-low px-2 font-medium')}
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded bg-brand px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Đang mời...' : 'Chia sẻ'}
        </button>
      </div>
      {error ? (
        <p id="invite-error" role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-ink-subtle">Người được mời cần có tài khoản Kanban.</p>
      )}
    </form>
  );
}

function MemberRow({
  board,
  member,
  isMe,
  canManage,
  lastAdmin,
  actions,
}: {
  board: BoardDetail;
  member: BoardMember;
  isMe: boolean;
  /** Người đang xem là ADMIN */
  canManage: boolean;
  /** Đây là ADMIN duy nhất (chỉ có thể là chính mình) — không được hạ quyền / rời bảng */
  lastAdmin: boolean;
  actions: BoardActions;
}) {
  const menu = usePopoverAnchor();
  // ADMIN quản lý được mọi người; người khác chỉ mở được menu của chính mình (để rời bảng)
  const hasMenu = canManage || isMe;

  return (
    <li className="flex items-center gap-3 border-b border-surface-low py-3 last:border-0">
      <Avatar name={member.name} seed={member.id} src={member.avatarUrl} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {member.name}
          {isMe && <span className="ml-1 text-xs font-normal text-ink-subtle">(bạn)</span>}
        </p>
        <p className="truncate text-xs text-ink-subtle">{member.email}</p>
      </div>
      {hasMenu ? (
        <button
          type="button"
          onClick={menu.toggle}
          aria-haspopup="dialog"
          aria-expanded={!!menu.anchor}
          aria-label={`Vai trò của ${member.name}: ${roleLabel(member.role)}. Đổi vai trò hoặc xoá`}
          className="group flex h-8 shrink-0 items-center gap-1 rounded bg-surface-low px-2.5 text-xs font-medium transition-colors hover:bg-surface-mid aria-expanded:bg-card aria-expanded:text-brand aria-expanded:ring-1 aria-expanded:ring-brand"
        >
          {roleLabel(member.role)}
          <ChevronDown size={14} className="transition-transform group-aria-expanded:rotate-180" />
        </button>
      ) : (
        <span className="shrink-0 px-2.5 text-xs font-medium text-ink-subtle">{roleLabel(member.role)}</span>
      )}

      <Popover anchor={menu.anchor} onClose={menu.close} label={`Vai trò của ${member.name}`} align="end" width={264}>
        <MemberMenu
          board={board}
          member={member}
          isMe={isMe}
          canManage={canManage}
          lastAdmin={lastAdmin}
          actions={actions}
          onClose={menu.close}
        />
      </Popover>
    </li>
  );
}

type Confirm = { kind: 'remove' } | { kind: 'leave' } | { kind: 'demote-self'; role: BoardRole } | null;

function MemberMenu({
  board,
  member,
  isMe,
  canManage,
  lastAdmin,
  actions,
  onClose,
}: {
  board: BoardDetail;
  member: BoardMember;
  isMe: boolean;
  canManage: boolean;
  lastAdmin: boolean;
  actions: BoardActions;
  onClose: () => void;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [leaving, setLeaving] = useState(false);

  function pickRole(role: BoardRole) {
    if (role === member.role) return onClose();
    // Tự hạ quyền ADMIN thì không tự lấy lại được → hỏi lại
    if (isMe && member.role === 'ADMIN') return setConfirm({ kind: 'demote-self', role });
    onClose();
    void actions.changeMemberRole(member.id, role);
  }

  async function leave() {
    setLeaving(true);
    try {
      await actions.leaveBoard();
      toast.success(`Đã rời bảng "${board.title}"`);
      router.replace('/boards');
    } catch (e) {
      toast.error(errorMessage(e));
      setLeaving(false);
    }
  }

  if (confirm) {
    const content = {
      remove: {
        title: 'Xoá khỏi bảng?',
        text: (
          <>
            <strong className="text-ink">{member.name}</strong> sẽ không còn xem hay sửa được bảng này. Bạn có thể mời lại sau.
          </>
        ),
        button: 'Xoá khỏi bảng',
        run: () => {
          onClose();
          void actions.removeMember(member.id);
        },
      },
      leave: {
        title: 'Rời bảng?',
        text: <>Bạn sẽ không còn truy cập được bảng này cho tới khi được mời lại.</>,
        button: leaving ? 'Đang rời...' : 'Rời bảng',
        run: () => void leave(),
      },
      'demote-self': {
        title: 'Hạ quyền của bạn?',
        text: (
          <>
            Bạn sẽ thành <strong className="text-ink">{confirm.kind === 'demote-self' ? roleLabel(confirm.role) : ''}</strong>{' '}
            và không thể tự lấy lại quyền quản trị.
          </>
        ),
        button: 'Hạ quyền',
        run: () => {
          if (confirm.kind !== 'demote-self') return;
          onClose();
          void actions.changeMemberRole(member.id, confirm.role);
        },
      },
    }[confirm.kind];

    return (
      <>
        <PopoverHeader title={content.title} onClose={onClose} />
        <p className="px-1 text-sm text-ink-subtle">{content.text}</p>
        <button
          type="button"
          onClick={content.run}
          disabled={leaving}
          className="mt-3 h-9 w-full rounded bg-danger text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {content.button}
        </button>
      </>
    );
  }

  return (
    <div role="menu" aria-label={`Vai trò của ${member.name}`} className="-m-1.5 flex flex-col">
      {canManage &&
        ROLES.map((r) => {
          const selected = r.value === member.role;
          const blocked = lastAdmin && r.value !== 'ADMIN';
          return (
            <button
              key={r.value}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              disabled={blocked}
              title={blocked ? 'Bảng cần ít nhất một quản trị viên' : undefined}
              onClick={() => pickRole(r.value)}
              className={cn(
                MENU_ITEM,
                selected ? 'bg-surface-low' : 'hover:bg-surface-low',
                'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
              )}
            >
              <span className="flex-1">
                <span className="block font-medium">{r.label}</span>
                <span className="block text-xs text-ink-subtle">{r.description}</span>
              </span>
              {selected && <Check size={16} className="mt-0.5 shrink-0 text-brand" />}
            </button>
          );
        })}

      {canManage && <hr className="my-1.5 border-surface-high" />}

      <button
        type="button"
        role="menuitem"
        disabled={lastAdmin}
        title={lastAdmin ? 'Hãy chỉ định quản trị viên khác trước khi rời bảng' : undefined}
        onClick={() => setConfirm({ kind: isMe ? 'leave' : 'remove' })}
        className={cn(
          MENU_ITEM,
          'items-center text-danger hover:bg-danger-soft/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
        )}
      >
        {isMe ? <LogOut size={16} /> : <Trash2 size={16} />}
        {isMe ? 'Rời bảng' : 'Xoá khỏi bảng'}
      </button>

      {lastAdmin && (
        <p className="px-2.5 pt-1 pb-1.5 text-xs text-ink-subtle">
          Bạn là quản trị viên duy nhất. Hãy chỉ định quản trị viên khác trước khi hạ quyền hoặc rời bảng.
        </p>
      )}
    </div>
  );
}
