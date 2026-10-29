'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { toast } from '@/components/toast';
import { errorMessage } from '@/lib/api';
import { accountApi } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { AccountCard } from './account-ui';

/** Tab "Thông báo": bật / tắt email nhắc hạn chót (thông báo trong app luôn có). */
export function NotificationsSection() {
  const { user, updateUser } = useAuth();
  const [pending, setPending] = useState(false);
  if (!user) return null;
  const enabled = user.emailDueReminders;

  async function toggle() {
    setPending(true);
    try {
      updateUser(await accountApi.updateNotificationSettings({ emailDueReminders: !enabled }));
      toast.success(enabled ? 'Đã tắt email nhắc hạn chót' : 'Đã bật email nhắc hạn chót');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <AccountCard title="Email" description={<>Gửi tới {user.email}. Thông báo trong app (biểu tượng chuông) luôn được bật.</>}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p id="due-reminders-label" className="text-sm font-medium text-ink">
            Nhắc hạn chót
          </p>
          <p className="mt-1 text-sm text-ink-subtle">
            Khi thẻ được giao cho bạn còn dưới 24 giờ hoặc đã quá hạn. Nhiều thẻ cùng lúc được gộp vào 1 email.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby="due-reminders-label"
          onClick={() => void toggle()}
          disabled={pending}
          className={cn(
            'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60',
            enabled ? 'bg-brand' : 'bg-outline/40',
          )}
        >
          <span
            className={cn(
              'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
              enabled ? 'translate-x-5.5' : 'translate-x-0.5',
            )}
          />
        </button>
      </div>
    </AccountCard>
  );
}
