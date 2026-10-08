'use client';

import { Clock, LinkIcon, LoaderCircle, SquareKanban, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { toast } from '@/components/toast';
import { ApiError, errorMessage } from '@/lib/api';
import { backgroundClass } from '@/lib/board-backgrounds';
import { invitesApi, type InvitePreview } from '@/lib/boards-api';
import { cn } from '@/lib/cn';

const ROLE_LABEL = { MEMBER: 'Thành viên', VIEWER: 'Người xem' } as const;

type State =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; invite: InvitePreview };

const PRIMARY =
  'flex h-10 w-full items-center justify-center gap-2 rounded bg-brand text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60';
const SECONDARY =
  'flex h-10 w-full items-center justify-center rounded bg-surface-mid text-sm font-medium text-ink transition-colors hover:bg-surface-high disabled:opacity-60';

/** Trang mở liên kết mời: xem trước bảng → tham gia ngay / gửi yêu cầu / chờ duyệt / mở bảng. */
export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setState({ kind: 'ready', invite: await invitesApi.preview(token) });
    } catch (e) {
      setState(e instanceof ApiError && e.status === 404 ? { kind: 'invalid' } : { kind: 'error', message: errorMessage(e) });
    }
  }, [token]);

  useEffect(() => {
    document.title = 'Lời mời tham gia bảng | Kanban';
    void load();
  }, [load]);

  async function join(invite: InvitePreview) {
    setBusy(true);
    try {
      const result = await invitesApi.join(token);
      if (result.status === 'MEMBER') {
        toast.success(`Đã tham gia bảng "${invite.board.title}"`);
        router.replace(`/b/${result.boardId}`);
        return;
      }
      setState({ kind: 'ready', invite: { ...invite, status: 'PENDING' } });
      toast.success('Đã gửi yêu cầu tham gia');
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setState({ kind: 'invalid' });
      else toast.error(errorMessage(e));
    }
    setBusy(false);
  }

  async function cancel(invite: InvitePreview) {
    setBusy(true);
    try {
      await invitesApi.cancelRequest(token);
      setState({ kind: 'ready', invite: { ...invite, status: 'NONE' } });
      toast.success('Đã huỷ yêu cầu tham gia');
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setState({ kind: 'invalid' });
      else toast.error(errorMessage(e));
    }
    setBusy(false);
  }

  /** Đang chờ duyệt → kiểm tra lại (chưa có thông báo realtime). */
  async function refresh() {
    setBusy(true);
    await load();
    setBusy(false);
  }

  if (state.kind === 'loading') {
    return (
      <Shell>
        <div className="flex h-64 items-center justify-center" aria-busy="true">
          <LoaderCircle size={28} className="animate-spin text-brand" aria-label="Đang tải lời mời" />
        </div>
      </Shell>
    );
  }

  if (state.kind !== 'ready') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-mid text-ink-subtle">
            <LinkIcon size={22} />
          </span>
          <h1 className="mt-2 text-lg font-semibold">
            {state.kind === 'invalid' ? 'Liên kết không hợp lệ hoặc đã bị tắt' : 'Không tải được lời mời'}
          </h1>
          <p className="text-sm text-ink-subtle">
            {state.kind === 'invalid'
              ? 'Liên kết có thể đã bị quản trị viên tạo lại hoặc tắt. Hãy xin liên kết mới từ người đã gửi cho bạn.'
              : state.message}
          </p>
          <div className="mt-4 flex w-full max-w-60 flex-col gap-2">
            {state.kind === 'error' && (
              <button type="button" onClick={() => void refresh()} disabled={busy} className={PRIMARY}>
                Thử lại
              </button>
            )}
            <Link href="/boards" className={SECONDARY}>
              Về danh sách bảng
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  const { invite } = state;
  const { board } = invite;

  return (
    <Shell>
      <div className={cn('flex h-28 items-end bg-linear-to-br px-6 pb-4', backgroundClass(board.background))}>
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/20 text-white shadow-sm backdrop-blur">
          <SquareKanban size={26} />
        </span>
      </div>
      <div className="px-6 pt-5 pb-6">
        <p className="text-xs font-semibold tracking-wider text-ink-subtle uppercase">Lời mời tham gia bảng</p>
        <h1 className="mt-1 text-2xl font-semibold wrap-break-word">{board.title}</h1>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-subtle">
          <Users size={16} aria-hidden />
          {board.memberCount} thành viên
        </p>

        {invite.status === 'MEMBER' ? (
          <>
            <Note>Bạn đã là thành viên của bảng này.</Note>
            <Link href={`/b/${board.id}`} className={cn(PRIMARY, 'mt-5')}>
              Mở bảng
            </Link>
          </>
        ) : invite.status === 'PENDING' ? (
          <>
            <Note icon={<Clock size={18} className="shrink-0 text-amber-600" />}>
              <strong className="font-semibold">Đã gửi yêu cầu</strong> — đang chờ quản trị viên duyệt. Bạn có thể quay lại
              liên kết này để xem trạng thái.
            </Note>
            <div className="mt-5 flex flex-col gap-2">
              <button type="button" onClick={() => void refresh()} disabled={busy} className={PRIMARY}>
                Kiểm tra lại
              </button>
              <button type="button" onClick={() => void cancel(invite)} disabled={busy} className={SECONDARY}>
                Huỷ yêu cầu
              </button>
            </div>
          </>
        ) : (
          <>
            <Note>
              {invite.requiresApproval ? (
                <>
                  Bảng này cần <strong className="font-semibold">quản trị viên duyệt</strong>. Khi được duyệt, bạn sẽ vào
                  bảng với vai trò do quản trị viên chọn.
                </>
              ) : (
                <>
                  Bạn sẽ tham gia với vai trò <strong className="font-semibold">{ROLE_LABEL[invite.role]}</strong>
                  {invite.role === 'VIEWER' ? ' (chỉ xem)' : ' (thêm, sửa danh sách và thẻ)'}.
                </>
              )}
            </Note>
            <button type="button" onClick={() => void join(invite)} disabled={busy} className={cn(PRIMARY, 'mt-5')}>
              {busy && <LoaderCircle size={16} className="animate-spin" />}
              {invite.requiresApproval ? 'Gửi yêu cầu tham gia' : 'Tham gia bảng'}
            </button>
          </>
        )}

        <Link href="/boards" className="mt-3 block text-center text-sm text-ink-subtle hover:text-ink hover:underline">
          Về danh sách bảng
        </Link>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="flex justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-[0_8px_24px_rgba(9,30,66,0.15),0_0_1px_rgba(9,30,66,0.31)]">
        {children}
      </div>
    </main>
  );
}

function Note({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-2 rounded-lg bg-surface-low px-3 py-2.5 text-sm text-ink">
      {icon}
      <span>{children}</span>
    </p>
  );
}
