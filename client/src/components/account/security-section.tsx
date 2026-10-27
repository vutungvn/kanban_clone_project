'use client';

import { LoaderCircle, LockKeyhole, LogOut, Monitor, Smartphone } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Popover, PopoverHeader, usePopoverAnchor } from '@/components/popover';
import { toast } from '@/components/toast';
import { PasswordField } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { accountApi, describeUserAgent, type Session } from '@/lib/auth';
import { formatFull, formatRelative } from '@/lib/card-dates';
import { AccountCard, DANGER_LINK_BUTTON, PRIMARY_BUTTON } from './account-ui';

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;

/** Tab "Bảo mật": đổi mật khẩu + các thiết bị đang đăng nhập. */
export function SecuritySection() {
  const sessions = useSessions();
  return (
    <div className="flex flex-col gap-6">
      <PasswordCard onChanged={sessions.reload} />
      <SessionsCard {...sessions} />
    </div>
  );
}

// ---------- Đổi mật khẩu ----------

type PasswordErrors = Partial<Record<'current' | 'next' | 'confirm', string>>;

function PasswordCard({ onChanged }: { onChanged: () => void }) {
  const [values, setValues] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [pending, setPending] = useState(false);

  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors((errs) => ({ ...errs, [key]: undefined }));
  };

  function validate(): PasswordErrors {
    const errs: PasswordErrors = {};
    if (!values.current) errs.current = 'Vui lòng nhập mật khẩu hiện tại';
    if (values.next.length < MIN_PASSWORD) errs.next = `Mật khẩu mới tối thiểu ${MIN_PASSWORD} ký tự`;
    else if (values.next === values.current) errs.next = 'Mật khẩu mới phải khác mật khẩu hiện tại';
    if (values.confirm !== values.next) errs.confirm = 'Mật khẩu nhập lại không khớp';
    return errs;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) return setErrors(errs);
    setPending(true);
    try {
      const count = await accountApi.changePassword(values.current, values.next);
      setValues({ current: '', next: '', confirm: '' });
      toast.success(count ? `Đã đổi mật khẩu. ${count} thiết bị khác đã bị đăng xuất.` : 'Đã đổi mật khẩu');
      onChanged();
    } catch (err) {
      const message = errorMessage(err);
      // Gắn lỗi của server vào đúng ô ("Mật khẩu mới..." trước: câu đó cũng có chữ "hiện tại")
      if (err instanceof ApiError && err.status === 400 && /mới/.test(message)) setErrors({ next: message });
      else if (err instanceof ApiError && err.status === 400 && /hiện tại/.test(message)) setErrors({ current: message });
      else toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <AccountCard title="Đổi mật khẩu" description="Đổi xong, mọi thiết bị khác sẽ bị đăng xuất. Thiết bị này vẫn giữ đăng nhập.">
      <form noValidate onSubmit={submit} className="flex max-w-md flex-col gap-4">
        <PasswordField
          id="current-password"
          label="Mật khẩu hiện tại"
          icon={LockKeyhole}
          autoComplete="current-password"
          value={values.current}
          error={errors.current}
          onChange={set('current')}
        />
        <PasswordField
          id="new-password"
          label="Mật khẩu mới"
          icon={LockKeyhole}
          autoComplete="new-password"
          maxLength={MAX_PASSWORD}
          value={values.next}
          error={errors.next}
          hint={`Tối thiểu ${MIN_PASSWORD} ký tự`}
          onChange={set('next')}
        />
        <PasswordField
          id="confirm-password"
          label="Nhập lại mật khẩu mới"
          icon={LockKeyhole}
          autoComplete="new-password"
          maxLength={MAX_PASSWORD}
          value={values.confirm}
          error={errors.confirm}
          onChange={set('confirm')}
        />
        <div>
          <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
            {pending && <LoaderCircle size={16} className="animate-spin" />}
            {pending ? 'Đang đổi...' : 'Đổi mật khẩu'}
          </button>
        </div>
      </form>
    </AccountCard>
  );
}

// ---------- Thiết bị đang đăng nhập ----------

function useSessions() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    accountApi.sessions().then(
      (list) => {
        setSessions(list);
        setError(null);
      },
      (e) => setError(errorMessage(e)),
    );
  }, []);

  useEffect(reload, [reload]);
  return { sessions, error, reload, setSessions };
}

function SessionsCard({
  sessions,
  error,
  reload,
  setSessions,
}: ReturnType<typeof useSessions>) {
  const confirm = usePopoverAnchor();
  const [pending, setPending] = useState<string | null>(null);
  const others = sessions?.filter((s) => !s.current) ?? [];

  async function revoke(session: Session) {
    setPending(session.id);
    try {
      await accountApi.revokeSession(session.id);
      setSessions((list) => list?.filter((s) => s.id !== session.id) ?? null);
      toast.success('Đã đăng xuất thiết bị đó');
    } catch (e) {
      toast.error(errorMessage(e));
      reload();
    } finally {
      setPending(null);
    }
  }

  async function revokeOthers() {
    confirm.close();
    setPending('all');
    try {
      const count = await accountApi.revokeOtherSessions();
      setSessions((list) => list?.filter((s) => s.current) ?? null);
      toast.success(`Đã đăng xuất ${count} thiết bị khác`);
    } catch (e) {
      toast.error(errorMessage(e));
      reload();
    } finally {
      setPending(null);
    }
  }

  return (
    <AccountCard
      title="Thiết bị đang đăng nhập"
      description="Không nhận ra một thiết bị? Hãy đăng xuất nó và đổi mật khẩu."
      action={
        others.length > 0 && (
          <button
            type="button"
            onClick={confirm.toggle}
            disabled={pending !== null}
            aria-haspopup="dialog"
            aria-expanded={!!confirm.anchor}
            className={DANGER_LINK_BUTTON}
          >
            <LogOut size={16} />
            Đăng xuất tất cả thiết bị khác
          </button>
        )
      }
    >
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : !sessions ? (
        <p className="flex items-center gap-2 text-sm text-ink-subtle">
          <LoaderCircle size={16} className="animate-spin" />
          Đang tải...
        </p>
      ) : (
        <ul className="-my-2 divide-y divide-surface-high">
          {sessions.map((s) => (
            <SessionRow key={s.id} session={s} pending={pending === s.id || pending === 'all'} onRevoke={() => void revoke(s)} />
          ))}
        </ul>
      )}

      <Popover anchor={confirm.anchor} onClose={confirm.close} label="Đăng xuất thiết bị khác" align="end">
        <PopoverHeader title="Đăng xuất thiết bị khác?" onClose={confirm.close} />
        <p className="px-1 text-sm text-ink-subtle">
          {others.length} thiết bị khác sẽ phải đăng nhập lại. Thiết bị này vẫn giữ đăng nhập.
        </p>
        <button
          type="button"
          onClick={() => void revokeOthers()}
          className="mt-3 h-9 w-full rounded bg-danger text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Đăng xuất {others.length} thiết bị
        </button>
      </Popover>
    </AccountCard>
  );
}

function SessionRow({ session: s, pending, onRevoke }: { session: Session; pending: boolean; onRevoke: () => void }) {
  const { browser, os, mobile } = describeUserAgent(s.userAgent);
  const Icon = mobile ? Smartphone : Monitor;
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-low text-ink-subtle">
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
          {browser} trên {os}
          {s.current && (
            <span className="rounded bg-success-soft px-1.5 py-0.5 text-[11px] font-semibold text-success-ink">Thiết bị này</span>
          )}
        </p>
        <p className="text-xs text-ink-subtle">
          {s.ipAddress && <>IP {s.ipAddress} · </>}
          {s.current ? (
            'Đang hoạt động'
          ) : (
            <time dateTime={s.lastActiveAt} title={formatFull(s.lastActiveAt)}>
              Hoạt động {formatRelative(s.lastActiveAt)}
            </time>
          )}
          {' · '}
          Đăng nhập <time dateTime={s.createdAt}>{formatFull(s.createdAt)}</time>
        </p>
      </div>
      {!s.current && (
        <button type="button" onClick={onRevoke} disabled={pending} className={DANGER_LINK_BUTTON}>
          {pending ? <LoaderCircle size={16} className="animate-spin" /> : <LogOut size={16} />}
          Đăng xuất
        </button>
      )}
    </li>
  );
}
