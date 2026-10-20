'use client';

import type { LucideIcon } from 'lucide-react';
import { useLayoutEffect, type ReactNode, type RefObject } from 'react';
import { cn } from '@/lib/cn';
import { labelColor, labelDisplayName } from '@/lib/labels';

// Thành phần dùng chung trong modal chi tiết thẻ và các popover của nó.

export const PRIMARY_BUTTON =
  'h-8 rounded bg-brand px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60';
export const SECONDARY_BUTTON =
  'h-8 rounded bg-surface-mid px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-high';
export const DANGER_BUTTON =
  'h-9 w-full rounded bg-danger text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60';
export const TEXT_INPUT =
  'h-9 w-full rounded bg-white px-2.5 text-sm text-ink shadow-[0_0_0_1px_rgba(9,30,66,0.14)] outline-none placeholder:text-outline focus:shadow-[0_0_0_2px_var(--color-brand)] disabled:bg-surface-low disabled:text-ink-subtle';
/** Tiêu đề nhỏ của từng nhóm trong popover */
export const POPOVER_SECTION = 'mb-1.5 mt-3 text-xs font-semibold text-ink-subtle';

/** Ô nhập tự cao theo nội dung. */
export function useAutosize(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, value]);
}

export function SectionHeading({ icon: Icon, title, children }: { icon: LucideIcon; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <Icon size={22} className="shrink-0 text-ink-subtle" aria-hidden />
        {typeof title === 'string' ? <h3 className="text-base font-semibold">{title}</h3> : title}
      </div>
      {children}
    </div>
  );
}

const CHIP_SIZE = {
  /** Trên thẻ ngoài bảng */
  xs: 'h-4 min-w-10 px-1.5 text-[11px] leading-4',
  /** Trong danh sách lọc */
  sm: 'h-6 min-w-10 px-2 text-xs leading-6',
  md: 'h-8 min-w-12 px-3 text-sm leading-8',
};

/** Nhãn màu. Nhãn không tên vẫn có chiều rộng tối thiểu. */
export function LabelChip({
  label,
  size = 'md',
  className,
}: {
  label: { name: string; color: string };
  size?: keyof typeof CHIP_SIZE;
  className?: string;
}) {
  const { bg, fg } = labelColor(label.color);
  return (
    <span
      title={labelDisplayName(label)}
      style={{ backgroundColor: bg, color: fg }}
      className={cn(
        'inline-block max-w-full truncate rounded align-middle font-medium',
        CHIP_SIZE[size],
        className,
      )}
    >
      {label.name}
    </span>
  );
}
