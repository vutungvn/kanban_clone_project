import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

// Thành phần dùng chung của trang Tài khoản.

export const PRIMARY_BUTTON =
  'inline-flex h-9 items-center justify-center gap-2 rounded bg-brand px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60';
export const SECONDARY_BUTTON =
  'inline-flex h-9 items-center justify-center gap-2 rounded bg-surface-mid px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-high disabled:cursor-not-allowed disabled:opacity-60';
export const DANGER_LINK_BUTTON =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded px-3 text-sm font-medium text-danger transition-colors hover:bg-danger-soft/40 disabled:opacity-60 aria-expanded:bg-danger-soft/40';

/** Khối nội dung có tiêu đề + mô tả. */
export function AccountCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  /** Nút ở góc phải tiêu đề */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-xl bg-card p-5 shadow-[0_0_0_1px_var(--color-hairline)] sm:p-6', className)}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description && <p className="mt-1 text-sm text-ink-subtle">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
