'use client';

import { LoaderCircle, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage } from '@/lib/api';
import { authApi } from '@/lib/auth';
import { cn } from '@/lib/cn';

/** Khớp với server: mỗi email chỉ được gửi lại 1 lần / phút */
const COOLDOWN_SECONDS = 60;

/** Nút "Gửi lại email xác minh" + đếm ngược 60 giây giữa 2 lần gửi. */
export function ResendVerificationButton({
  email,
  next,
  initialCooldown = false,
  className,
}: {
  email: string;
  next?: string | null;
  /** Vừa gửi xong (vd ngay sau khi đăng ký) → bắt đầu đếm ngược luôn */
  initialCooldown?: boolean;
  className?: string;
}) {
  const [seconds, setSeconds] = useState(initialCooldown ? COOLDOWN_SECONDS : 0);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  async function resend() {
    setPending(true);
    setMessage(null);
    try {
      await authApi.resendVerification(email, next);
      setSeconds(COOLDOWN_SECONDS);
      setMessage({ tone: 'success', text: `Đã gửi lại email tới ${email}` });
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <button
        type="button"
        onClick={() => void resend()}
        disabled={pending || seconds > 0 || !email}
        className="inline-flex h-9 items-center gap-2 rounded bg-surface-mid px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-high disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
        {seconds > 0 ? `Gửi lại sau ${seconds} giây` : 'Gửi lại email xác minh'}
      </button>
      {message && (
        <p role={message.tone === 'error' ? 'alert' : 'status'} className={cn('text-xs', message.tone === 'error' ? 'text-danger' : 'text-success-ink')}>
          {message.text}
        </p>
      )}
    </div>
  );
}
