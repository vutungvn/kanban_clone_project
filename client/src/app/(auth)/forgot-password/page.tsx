'use client';

import { Mail, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { AuthHeader } from '@/components/auth-header';
import { Alert, Field, SubmitButton } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { authApi } from '@/lib/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  // useSearchParams cần Suspense boundary khi build
  return (
    <Suspense>
      <ForgotPassword />
    </Suspense>
  );
}

/** Nhập email → gửi link đặt lại mật khẩu. Luôn báo "đã gửi" (không cho biết email có tồn tại). */
function ForgotPassword() {
  const [email, setEmail] = useState(useSearchParams().get('email') ?? '');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) return setFieldError('Email không hợp lệ');
    setPending(true);
    setError(null);
    try {
      await authApi.forgotPassword(value);
      setSentTo(value);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col items-center text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-high text-brand">
          <MailCheck size={28} />
        </span>
        <h1 className="text-xl font-semibold text-ink">Kiểm tra hộp thư của bạn</h1>
        <p className="mt-2 text-sm text-ink-subtle">
          Nếu <strong className="break-all text-ink">{sentTo}</strong> đã đăng ký, bạn sẽ nhận được liên kết đặt lại mật khẩu trong vài
          phút. Liên kết có hiệu lực 1 giờ.
        </p>
        <p className="mt-3 text-sm text-ink-subtle">Không thấy email? Hãy xem thư mục Spam, hoặc thử lại sau 1 phút.</p>
        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="mt-5 h-9 rounded bg-surface-mid px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-high"
        >
          Nhập email khác
        </button>
        <BackToLogin />
      </div>
    );
  }

  return (
    <>
      <AuthHeader subtitle="Quên mật khẩu" />
      <p className="mb-4 text-sm text-ink-subtle">Nhập email bạn đã đăng ký, chúng tôi sẽ gửi liên kết để đặt mật khẩu mới.</p>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <Field
          id="email"
          label="Email"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="nguyenvana@gmail.com"
          value={email}
          error={fieldError}
          autoFocus
          onChange={(e) => {
            setEmail(e.target.value);
            setFieldError(undefined);
          }}
        />
        {error && <Alert tone="error">{error}</Alert>}
        <SubmitButton pending={pending}>Gửi liên kết</SubmitButton>
      </form>
      <BackToLogin />
    </>
  );
}

function BackToLogin() {
  return (
    <p className="mt-6 text-center text-sm text-ink-subtle">
      Nhớ ra mật khẩu?{' '}
      <Link href="/login" className="font-semibold text-brand transition-colors hover:text-brand-hover hover:underline">
        Đăng nhập
      </Link>
    </p>
  );
}
