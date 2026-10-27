// Không có 'use client': app/layout.tsx (server component) cần đọc được chuỗi script này.

export const THEME_STORAGE_KEY = 'kanban.theme';

/**
 * Chạy trong <head> trước khi trang hiện ra (app/layout.tsx) → không bị chớp nền sáng khi đang dùng giao diện tối.
 * Giữ đúng logic với `applyTheme` trong lib/theme.ts.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');var d=p==='dark'||(p!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}})()`;
