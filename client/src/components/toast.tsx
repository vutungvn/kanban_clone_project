'use client';

import { useSyncExternalStore } from 'react';
import { Alert } from './ui';

type ToastItem = { id: number; tone: 'success' | 'error'; message: string };

const DURATION_MS = 4000;
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

function push(tone: ToastItem['tone'], message: string) {
  const item = { id: nextId++, tone, message };
  items = [...items, item];
  emit();
  setTimeout(() => dismiss(item.id), DURATION_MS);
}

/** Gọi từ bất cứ đâu: toast.error('...') — hiển thị bởi <Toaster /> trong layout. */
export const toast = {
  error: (message: string) => push('error', message),
  success: (message: string) => push('success', message),
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => items;

export function Toaster() {
  const toasts = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 left-1/2 z-60 flex w-80 -translate-x-1/2 flex-col gap-2"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto rounded bg-white shadow-lg">
          <Alert tone={t.tone} onClose={() => dismiss(t.id)}>
            {t.message}
          </Alert>
        </div>
      ))}
    </div>
  );
}
