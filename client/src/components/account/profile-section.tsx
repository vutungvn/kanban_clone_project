'use client';

import { Camera, LoaderCircle, Mail, Trash2, UserRound } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Avatar } from '@/components/avatar';
import { toast } from '@/components/toast';
import { Field } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { accountApi, type User } from '@/lib/auth';
import { formatFull } from '@/lib/card-dates';
import { AccountCard, PRIMARY_BUTTON, SECONDARY_BUTTON } from './account-ui';

const MAX_NAME = 50;
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const AVATAR_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';

/** Tab "Hồ sơ": ảnh đại diện + tên hiển thị. */
export function ProfileSection() {
  const { user, updateUser } = useAuth();
  if (!user) return null;
  return (
    <div className="flex flex-col gap-6">
      <AvatarCard user={user} onChange={updateUser} />
      <NameCard user={user} onChange={updateUser} />
    </div>
  );
}

function AvatarCard({ user, onChange }: { user: User; onChange: (user: User) => void }) {
  const input = useRef<HTMLInputElement>(null);
  // null = không tải lên; số = tiến độ 0 → 1
  const [progress, setProgress] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const busy = progress !== null || removing;

  async function upload(file: File) {
    if (file.size > MAX_AVATAR_SIZE) return toast.error('Ảnh đại diện tối đa 5 MB');
    setProgress(0);
    try {
      onChange(await accountApi.setAvatar(file, setProgress));
      toast.success('Đã đổi ảnh đại diện');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setProgress(null);
    }
  }

  async function remove() {
    setRemoving(true);
    try {
      onChange(await accountApi.removeAvatar());
      toast.success('Đã gỡ ảnh đại diện');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <AccountCard title="Ảnh đại diện" description="Hiện cạnh tên của bạn trong bảng, thẻ, bình luận và thông báo.">
      <div className="flex flex-wrap items-center gap-5">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label="Đổi ảnh đại diện"
          className="group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <Avatar name={user.name} seed={user.id} src={user.avatarUrl} size={88} />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-disabled:opacity-100">
            {busy ? (
              progress !== null && progress < 1 ? (
                <span className="text-sm font-semibold">{Math.round(progress * 100)}%</span>
              ) : (
                <LoaderCircle size={24} className="animate-spin" />
              )
            ) : (
              <Camera size={24} />
            )}
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-subtle">JPG, PNG, GIF hoặc WEBP, tối đa 5 MB. Ảnh được cắt vuông, ưu tiên khuôn mặt.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => input.current?.click()} disabled={busy} className={PRIMARY_BUTTON}>
              <Camera size={16} />
              {user.avatarUrl ? 'Đổi ảnh' : 'Tải ảnh lên'}
            </button>
            {user.avatarUrl && (
              <button type="button" onClick={() => void remove()} disabled={busy} className={SECONDARY_BUTTON}>
                <Trash2 size={16} />
                Gỡ ảnh
              </button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        hidden
        accept={AVATAR_ACCEPT}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void upload(file);
        }}
      />
    </AccountCard>
  );
}

function NameCard({ user, onChange }: { user: User; onChange: (user: User) => void }) {
  const [name, setName] = useState(user.name);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const unchanged = name.trim() === user.name;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return setError('Vui lòng nhập tên');
    if (value === user.name) return;
    setPending(true);
    try {
      const next = await accountApi.updateProfile(value);
      onChange(next);
      setName(next.name);
      toast.success('Đã lưu tên hiển thị');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <AccountCard
      title="Thông tin cá nhân"
      description={
        <>
          Thành viên từ <time dateTime={user.createdAt}>{formatFull(user.createdAt)}</time>
        </>
      }
    >
      <form noValidate onSubmit={submit} className="flex max-w-md flex-col gap-4">
        <Field
          id="profile-name"
          label="Tên hiển thị"
          icon={UserRound}
          value={name}
          maxLength={MAX_NAME}
          autoComplete="name"
          labelAside={`${name.length}/${MAX_NAME}`}
          error={error}
          onChange={(e) => {
            setName(e.target.value);
            setError(undefined);
          }}
        />
        <Field
          id="profile-email"
          label="Email"
          icon={Mail}
          value={user.email}
          readOnly
          disabled
          hint={`${user.emailVerifiedAt ? 'Đã xác minh' : 'Chưa xác minh'} · dùng để đăng nhập, hiện chưa đổi được.`}
        />
        <div>
          <button type="submit" disabled={pending || unchanged} className={PRIMARY_BUTTON}>
            {pending && <LoaderCircle size={16} className="animate-spin" />}
            {pending ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </AccountCard>
  );
}
