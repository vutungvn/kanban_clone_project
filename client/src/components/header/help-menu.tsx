'use client';

import { CircleHelp } from 'lucide-react';
import { Popover, PopoverHeader, usePopoverAnchor } from '@/components/popover';
import { HEADER_ICON_BUTTON } from './styles';

const SHORTCUTS = [
  { keys: ['/'], label: 'Tìm kiếm bảng' },
  { keys: ['↑', '↓'], label: 'Chọn kết quả tìm kiếm' },
  { keys: ['Enter'], label: 'Mở bảng đang chọn' },
  { keys: ['Esc'], label: 'Đóng menu, cửa sổ' },
];

export function HelpMenu() {
  const { anchor, toggle, close } = usePopoverAnchor();

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label="Trợ giúp"
        title="Trợ giúp"
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        className={HEADER_ICON_BUTTON}
      >
        <CircleHelp size={20} />
      </button>

      <Popover anchor={anchor} onClose={close} label="Trợ giúp" align="end">
        <PopoverHeader title="Trợ giúp" onClose={close} />
        <p className="px-1 pb-1.5 text-[11px] font-semibold tracking-wider text-ink-subtle uppercase">Phím tắt</p>
        <ul className="flex flex-col">
          {SHORTCUTS.map(({ keys, label }) => (
            <li key={label} className="flex items-center justify-between rounded px-1 py-1.5 text-sm">
              <span>{label}</span>
              <span className="flex gap-1">
                {keys.map((k) => (
                  <kbd
                    key={k}
                    className="min-w-6 rounded border border-surface-highest bg-surface-low px-1.5 text-center text-xs leading-5 text-ink-subtle"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 border-t border-surface-high px-1 pt-2 text-xs text-ink-subtle">Kanban · phiên bản 0.1.0</p>
      </Popover>
    </>
  );
}
