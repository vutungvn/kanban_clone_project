'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Field, FormError, SubmitButton } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { getSafeNextPath } from '@/lib/auth';

export default function LoginPage() {
  // useSearchParams cần Suspense boundary khi build
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get('registered') === '1';
  const prefillEmail = searchParams.get('email') ?? '';

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      await login({ email: String(form.get('email')), password: String(form.get('password')) });
      router.replace(getSafeNextPath());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể kết nối tới máy chủ');
      setPending(false);
    }
  }

  return (
    <>
      <h2 className="mb-4 text-center text-sm text-slate-500">Đăng nhập vào tài khoản của bạn</h2>
      {justRegistered && !error && (
        <p role="status" className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Đăng ký thành công! Vui lòng đăng nhập để tiếp tục.
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="Email"
          id="email"
          type="email"
          autoComplete="email"
          defaultValue={prefillEmail}
          required
          autoFocus={!prefillEmail}
        />
        <Field
          label="Mật khẩu"
          id="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus={!!prefillEmail}
        />
        <FormError message={error} />
        <SubmitButton pending={pending}>Đăng nhập</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Chưa có tài khoản?{' '}
        <Link href="/register" className="font-medium text-blue-600 hover:underline">
          Đăng ký
        </Link>
      </p>
    </>
  );
}
