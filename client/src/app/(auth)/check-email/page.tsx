'use client';

import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ResendVerificationButton } from '@/components/resend-verification';
import { authHref } from '@/lib/auth';

export default function CheckEmailPage() {
  // useSearchParams cần Suspense boundary khi build
  return (
    <Suspense>
      <CheckEmail />
    </Suspense>
  );
}

/** Sau khi đăng ký (server có SMTP): nhắc mở email để xác minh. /check-email?email=...&next=... */
function CheckEmail() {
  const params = useSearchParams();
  const email = params.get('email') ?? '';
  const next = params.get('next');

  return (
    <div className="flex flex-col items-center text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-high text-brand">
        <MailCheck size={28} />
      </span>
      <h1 className="text-xl font-semibold text-ink">Kiểm tra hộp thư của bạn</h1>
      <p className="mt-2 text-sm text-ink-subtle">
        Chúng tôi đã gửi liên kết xác minh tới
        {email ? <strong className="block break-all text-ink">{email}</strong> : ' email bạn vừa đăng ký.'}
      </p>
      <p className="mt-3 text-sm text-ink-subtle">
        Bấm liên kết trong email để kích hoạt tài khoản (có hiệu lực 24 giờ). Không thấy email? Hãy xem cả thư mục Spam / Quảng cáo.
      </p>

      <ResendVerificationButton email={email} next={next} initialCooldown className="mt-6" />

      <p className="mt-6 text-sm text-ink-subtle">
        Đã xác minh?{' '}
        <Link
          href={authHref('/login', next, email ? { email } : {})}
          className="font-semibold text-brand transition-colors hover:text-brand-hover hover:underline"
        >
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
