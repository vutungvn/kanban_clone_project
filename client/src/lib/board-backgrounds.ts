/**
 * Phông nền dựng sẵn của board. Board chỉ lưu `key`, client tự map ra màu.
 * className chỉ chứa màu gradient — hướng (bg-linear-to-r / to-br) do nơi dùng quyết định.
 */
export const BOARD_BACKGROUNDS = {
  blue: { label: 'Xanh dương', className: 'from-brand-hover to-brand' },
  purple: { label: 'Tím', className: 'from-indigo-700 to-purple-600' },
  sunset: { label: 'Hoàng hôn', className: 'from-rose-600 to-orange-500' },
  green: { label: 'Xanh lá', className: 'from-emerald-700 to-emerald-500' },
  teal: { label: 'Xanh ngọc', className: 'from-teal-700 to-cyan-600' },
  dark: { label: 'Tối', className: 'from-slate-800 to-slate-600' },
} as const;

export type BoardBackground = keyof typeof BOARD_BACKGROUNDS;

export const BACKGROUND_KEYS = Object.keys(BOARD_BACKGROUNDS) as BoardBackground[];

/** Class màu của phông nền; key lạ (dữ liệu cũ, server thêm màu mới) → dùng màu mặc định. */
export function backgroundClass(key: string) {
  return (BOARD_BACKGROUNDS[key as BoardBackground] ?? BOARD_BACKGROUNDS.blue).className;
}
