'use client';

import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const VIEWPORT_MARGIN = 8;

let openCount = 0;
/** Có popover nào đang mở không — modal dùng để Esc / bấm nền chỉ đóng popover trước. */
export const isPopoverOpen = () => openCount > 0;

/**
 * Popover neo vào một phần tử (anchor). Mở khi `anchor` khác null.
 * Tự canh trong màn hình, đóng khi bấm ra ngoài hoặc nhấn Esc.
 */
export function Popover({
  anchor,
  onClose,
  label,
  width = 304,
  align = 'start',
  children,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  label: string;
  width?: number;
  /** start: canh mép trái anchor; end: canh mép phải */
  align?: 'start' | 'end';
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchor) return;
    const update = () => {
      const rect = anchor.getBoundingClientRect();
      const height = ref.current?.offsetHeight ?? 0;
      const preferredLeft = align === 'end' ? rect.right - width : rect.left;
      const left = Math.max(VIEWPORT_MARGIN, Math.min(preferredLeft, window.innerWidth - width - VIEWPORT_MARGIN));
      let top = rect.bottom + 6;
      if (top + height > window.innerHeight - VIEWPORT_MARGIN) {
        top = Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN);
      }
      setPos({ top, left });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchor, align, width]);

  const open = !!anchor;
  useEffect(() => {
    if (!open) return;
    openCount++;
    return () => {
      openCount--;
    };
  }, [open]);

  useEffect(() => {
    if (!anchor) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      // Bấm vào anchor để nút trigger tự xử lý bật/tắt
      if (!ref.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [anchor, onClose]);

  if (!anchor) return null;

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      style={{ width, top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
      className="fixed z-50 rounded-lg bg-white p-3 text-ink shadow-[0_8px_24px_rgba(9,30,66,0.2),0_0_1px_rgba(9,30,66,0.31)]"
    >
      {children}
    </div>,
    document.body,
  );
}

/** Tiêu đề căn giữa + nút đóng — kiểu popover của Trello. */
export function PopoverHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="relative mb-3 flex items-center justify-center">
      <h2 className="text-sm font-semibold text-ink-subtle">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng"
        className="absolute right-0 rounded p-1 text-ink-subtle transition-colors hover:bg-surface-mid hover:text-ink"
      >
        <X size={16} />
      </button>
    </div>
  );
}

/** Quản lý anchor cho 1 popover: bấm trigger lần nữa thì đóng. */
export function usePopoverAnchor() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [close] = useState(() => () => setAnchor(null));
  const toggle = (e: MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    setAnchor((prev) => (prev === el ? null : el));
  };
  return { anchor, toggle, close };
}
