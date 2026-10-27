'use client';

import { useEffect, useState } from 'react';
import { THEME_STORAGE_KEY } from './theme-script';

/** Lựa chọn của người dùng — nhớ theo trình duyệt. "system": theo cài đặt sáng / tối của máy. */
export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
  { value: 'system', label: 'Theo hệ thống' },
];

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

/** Đổi cả trang cùng lúc: tắt tạm hiệu ứng chuyển màu (không thì mỗi phần tử đổi màu một nhịp, trông lệch). */
function applyTheme(preference: ThemePreference) {
  const dark = preference === 'dark' || (preference === 'system' && systemDark());
  const pause = document.createElement('style');
  pause.textContent = '*,*::before,*::after{transition:none!important}';
  document.head.append(pause);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  void getComputedStyle(document.body).color; // áp màu mới ngay khi còn tắt hiệu ứng
  requestAnimationFrame(() => pause.remove());
}

const listeners = new Set<(preference: ThemePreference) => void>();

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Không lưu được (chế độ riêng tư...) → vẫn đổi cho lần mở này
  }
  applyTheme(preference);
  listeners.forEach((listener) => listener(preference));
}

/** Giao diện đang chọn + hàm đổi. Theo dõi máy đổi sáng / tối (khi chọn "Theo hệ thống") và tab khác đổi lựa chọn. */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>('system');

  useEffect(() => {
    setPreference(readPreference());
    listeners.add(setPreference);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => readPreference() === 'system' && applyTheme('system');
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY) return;
      const next = readPreference();
      applyTheme(next);
      setPreference(next);
    };
    media.addEventListener('change', onSystemChange);
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(setPreference);
      media.removeEventListener('change', onSystemChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return [preference, setThemePreference] as const;
}
