'use client';

import { CircleAlert, LoaderCircle, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { ResendVerificationButton } from '@/components/resend-verification';
import { Field } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { authApi, authHref } from '@/lib/auth';

export default function VerifyEmailPage() {
  // useSearchParams cần Suspense boundary khi build
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}

/**
 * Mở từ link trong email: /verify-email?token=...&next=...
 * Thành công → về trang đăng nhập (điền sẵn email); lỗi → cho nhập email để gửi lại link.
 */
function VerifyEmail() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');
  const next = params.get('next');
  const [error, setError] = useState<string | null>(token ? null : 'Liên kết xác minh không hợp lệ');
  const [email, setEmail] = useState('');
  const started = useRef(false);

  useEffect(() => {
    // Chỉ gọi 1 lần (React gọi effect 2 lần khi dev)
    if (!token || started.current) return;
    started.current = true;
    authApi.verifyEmail(token).then(
      ({ email }) => router.replace(authHref('/login', next, { verified: '1', email })),
      (e) => setError(errorMessage(e)),
    );
  }, [token, next, router]);

  if (!error) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 py-6 text-center text-sm text-ink-subtle">
        <LoaderCircle size={28} className="animate-spin text-brand" />
        Đang xác minh email...
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger">
        <CircleAlert size={28} />
      </span>
      <h1 className="text-xl font-semibold text-ink">Không xác minh được email</h1>
      <p className="mt-2 text-sm text-ink-subtle">{error}. Nhập email đã đăng ký để nhận liên kết mới.</p>
      <div className="mt-5 w-full text-left">
        <Field
          id="email"
          label="Email"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="nguyenvana@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value.trim())}
        />
      </div>
      <ResendVerificationButton email={email} next={next} className="mt-4" />
      <p className="mt-6 text-sm text-ink-subtle">
        <Link href={authHref('/login', next)} className="font-semibold text-brand transition-colors hover:text-brand-hover hover:underline">
          Quay lại đăng nhập
        </Link>
      </p>
    </div>
  );
}
