'use client';

import { Bell, Check, X } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'success' | 'error' | 'info';
type ToastItem = { id: number; tone: Tone; message: string; leaving?: boolean };

const DURATION_MS = 4000;
const EXIT_MS = 180; // khớp với animate-toast-out trong globals.css
const MAX_VISIBLE = 3;
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/** Chạy hiệu ứng biến mất rồi mới gỡ khỏi danh sách. */
function dismiss(id: number) {
  const item = items.find((t) => t.id === id);
  if (!item || item.leaving) return;
  items = items.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, EXIT_MS);
}

function push(tone: Tone, message: string) {
  items = [...items, { id: nextId++, tone, message }];
  emit();
  // Nhiều toast dồn dập (vd mời liên tiếp) → chỉ giữ vài cái mới nhất
  const active = items.filter((t) => !t.leaving);
  active.slice(0, Math.max(0, active.length - MAX_VISIBLE)).forEach((t) => dismiss(t.id));
}

/** Gọi từ bất cứ đâu: toast.error('...') — hiển thị bởi <Toaster /> trong layout. */
export const toast = {
  error: (message: string) => push('error', message),
  success: (message: string) => push('success', message),
  /** Tin mới (vd thông báo vừa đến) */
  info: (message: string) => push('info', message),
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => items;

const TONES: Record<Tone, { badge: string; bar: string }> = {
  success: { badge: 'bg-success', bar: 'bg-success' },
  error: { badge: 'bg-danger', bar: 'bg-danger' },
  info: { badge: 'bg-brand', bar: 'bg-brand' },
};

export function Toaster() {
  const toasts = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-60 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} item={t} />
      ))}
    </div>
  );
}

/** Rê chuột / focus vào thì tạm dừng đếm giờ để kịp đọc. */
function ToastCard({ item }: { item: ToastItem }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(DURATION_MS);
  const { badge, bar } = TONES[item.tone];

  useEffect(() => {
    if (paused || item.leaving) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => dismiss(item.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt;
    };
  }, [paused, item.leaving, item.id]);

  return (
    <div
      role={item.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        'pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-lg bg-card py-3 pr-2.5 pl-3.5 shadow-[0_8px_24px_rgba(9,30,66,0.22),0_0_0_1px_var(--color-hairline)] motion-reduce:animate-none',
        item.leaving ? 'animate-toast-out' : 'animate-toast-in',
      )}
    >
      <span className={cn('mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white', badge)}>
        {item.tone === 'success' ? (
          <Check size={13} strokeWidth={3} />
        ) : item.tone === 'info' ? (
          <Bell size={12} strokeWidth={2.5} />
        ) : (
          <span className="text-[13px] leading-none font-bold">!</span>
        )}
      </span>
      <p className="flex-1 text-sm leading-5.5 font-medium text-ink">{item.message}</p>
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        aria-label="Đóng thông báo"
        className="-my-0.5 shrink-0 rounded p-1 text-ink-subtle transition-colors hover:bg-surface-low hover:text-ink"
      >
        <X size={16} />
      </button>
      {/* Thanh thời gian còn lại — dừng cùng lúc với bộ đếm khi rê chuột */}
      <span
        aria-hidden
        style={{ animationDuration: `${DURATION_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }}
        className={cn('absolute bottom-0 left-0 h-0.75 w-full origin-left animate-toast-timer opacity-60 motion-reduce:hidden', bar)}
      />
    </div>
  );
}
