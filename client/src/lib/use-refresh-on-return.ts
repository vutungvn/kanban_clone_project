'use client';

import { useEffect, useRef } from 'react';

/** Quay lại tab sau ít nhất ngần này thì mới tải lại (tránh gọi API mỗi lần chuyển tab qua lại) */
const MIN_INTERVAL_MS = 15_000;

/**
 * Gọi `reload` khi người dùng quay lại tab (trang không cập nhật realtime — tải lại cho nhẹ).
 * `reload` nên ổn định (useCallback).
 */
export function useRefreshOnReturn(reload: () => void) {
  const last = useRef(Date.now());
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last.current < MIN_INTERVAL_MS) return;
      last.current = Date.now();
      reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);
}
