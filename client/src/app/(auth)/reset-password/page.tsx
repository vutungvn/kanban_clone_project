'use client';

import { CircleAlert, KeyRound, LoaderCircle, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { AuthHeader } from '@/components/auth-header';
import { Alert, PasswordField, SubmitButton } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { authApi } from '@/lib/auth';

type FieldErrors = Partial<Record<'password' | 'confirmPassword', string>>;

const INVALID_LINK = 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn';

export default function ResetPasswordPage() {
  // useSearchParams cần Suspense boundary khi build
  return (
    <Suspense>
      <ResetPassword />
    </Suspense>
  );
}

/**
 * Mở từ link trong email: /reset-password?token=...
 * Kiểm tra link trước — link cũ / đã dùng / hết hạn thì không hiện form mà mời xin link mới.
 */
function ResetPassword() {
  const token = useSearchParams().get('token');
  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid'>(token ? 'checking' : 'invalid');
  const [invalidReason, setInvalidReason] = useState(INVALID_LINK);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    authApi.checkResetToken(token).then(
      () => !cancelled && setStatus('valid'),
      (e) => {
        if (cancelled) return;
        setInvalidReason(e instanceof ApiError && e.status === 400 ? INVALID_LINK : errorMessage(e));
        setStatus('invalid');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === 'checking') {
    return (
      <div role="status" className="flex flex-col items-center gap-3 py-6 text-center text-sm text-ink-subtle">
        <LoaderCircle size={28} className="animate-spin text-brand" />
        Đang kiểm tra liên kết...
      </div>
    );
  }
  if (status === 'invalid') return <InvalidLink reason={invalidReason} />;
  return <ResetForm token={token!} onInvalid={() => setStatus('invalid')} />;
}

function InvalidLink({ reason }: { reason: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger">
        <CircleAlert size={28} />
      </span>
      <h1 className="text-xl font-semibold text-ink">Liên kết không còn dùng được</h1>
      <p className="mt-2 text-sm text-ink-subtle">
        {reason}. Liên kết chỉ dùng được 1 lần, có hiệu lực 1 giờ và hết hiệu lực khi bạn yêu cầu liên kết mới.
      </p>
      <Link
        href="/forgot-password"
        className="mt-5 inline-flex h-10 items-center rounded bg-brand px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-hover"
      >
        Gửi liên kết mới
      </Link>
      <p className="mt-6 text-sm text-ink-subtle">
        <Link href="/login" className="font-semibold text-brand transition-colors hover:text-brand-hover hover:underline">
          Quay lại đăng nhập
        </Link>
      </p>
    </div>
  );
}

function ResetForm({ token, onInvalid }: { token: string; onInvalid: () => void }) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const clearFieldError = (key: keyof FieldErrors) => setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get('password'));
    const confirmPassword = String(form.get('confirmPassword'));
    const errors: FieldErrors = {};
    if (password.length < 8) errors.password = 'Mật khẩu tối thiểu 8 ký tự';
    else if (password.length > 72) errors.password = 'Mật khẩu tối đa 72 ký tự';
    if (confirmPassword !== password) errors.confirmPassword = 'Mật khẩu nhập lại không khớp';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setPending(true);
    setError(null);
    try {
      await authApi.resetPassword(token, password);
      router.replace('/login?reset=1');
    } catch (err) {
      // Link vừa hết hạn / bị thay thế trong lúc đang nhập
      if (err instanceof ApiError && err.message === INVALID_LINK) return onInvalid();
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <>
      <AuthHeader subtitle="Đặt mật khẩu mới" />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <PasswordField
          id="password"
          label="Mật khẩu mới"
          icon={Lock}
          autoComplete="new-password"
          hint="Tối thiểu 8 ký tự"
          placeholder="Nhập mật khẩu mới"
          error={fieldErrors.password}
          onChange={() => clearFieldError('password')}
          autoFocus
        />
        <PasswordField
          id="confirmPassword"
          label="Nhập lại mật khẩu mới"
          icon={KeyRound}
          autoComplete="new-password"
          placeholder="Nhập lại mật khẩu mới"
          error={fieldErrors.confirmPassword}
          onChange={() => clearFieldError('confirmPassword')}
        />
        {error && <Alert tone="error">{error}</Alert>}
        <p className="text-xs text-ink-subtle">Đặt xong, mọi thiết bị đang đăng nhập sẽ bị đăng xuất.</p>
        <SubmitButton pending={pending}>Đặt mật khẩu mới</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-ink-subtle">
        <Link href="/login" className="font-semibold text-brand transition-colors hover:text-brand-hover hover:underline">
          Quay lại đăng nhập
        </Link>
      </p>
    </>
  );
}
