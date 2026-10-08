'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { isPopoverOpen } from './popover';

const FOCUSABLE =
  'button:not([disabled]), textarea:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Modal phủ dưới header của app. Đóng bằng Esc, bấm nền hoặc nút X (`onClose`).
 * - Đang mở popover thì Esc / bấm nền chỉ đóng popover.
 * - Ô nhập tự xử lý Esc (huỷ sửa) thì gọi `e.preventDefault()` → modal giữ nguyên.
 * - Giữ Tab trong modal; đóng thì trả focus về phần tử trước đó.
 * Render vào <body>: tổ tiên có backdrop-filter / transform (vd header bảng) sẽ làm `fixed` bị neo theo tổ tiên đó.
 */
export function Modal({
  label,
  onClose,
  className,
  children,
}: {
  label: string;
  onClose: () => void;
  /** Class cho khung modal (thường là độ rộng, vd max-w-192) */
  className?: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const pressedBackdrop = useRef(false);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !isPopoverOpen()) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function trapFocus(e: KeyboardEvent) {
    const dialog = dialogRef.current;
    if (e.key !== 'Tab' || !dialog || !dialog.contains(e.target as Node)) return;
    const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (e.target === first || e.target === dialog)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && e.target === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div
      className="fixed inset-x-0 top-12 bottom-0 z-40 flex items-start justify-center overflow-y-auto bg-black/65 px-4 py-8 backdrop-blur-[4px] sm:py-12"
      // Bấm xuống và thả ra đều ở nền mới đóng — kéo bôi đen chữ từ trong modal ra ngoài không làm đóng
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget && !isPopoverOpen();
      }}
      onClick={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) onClose();
        pressedBackdrop.current = false;
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={trapFocus}
        className={cn(
          'relative my-auto w-full rounded-xl bg-white text-ink shadow-[0_20px_48px_rgba(9,30,66,0.45)] outline-none',
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Nút X ở góc phải trên của modal. */
export function ModalCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Đóng"
      title="Đóng (Esc)"
      className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-surface-mid hover:text-ink"
    >
      <X size={20} />
    </button>
  );
}
