'use client';

import { Check } from 'lucide-react';
import { BACKGROUND_KEYS, BOARD_BACKGROUNDS, type BoardBackground } from '@/lib/board-backgrounds';
import { cn } from '@/lib/cn';

/** Lưới 6 ô màu phông nền — dùng ở popover tạo bảng và menu bảng. */
export function BackgroundPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: BoardBackground;
  onChange: (key: BoardBackground) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-1.5 text-xs font-semibold">Phông nền</legend>
      <div className="grid grid-cols-6 gap-1.5">
        {BACKGROUND_KEYS.map((key) => {
          const selected = key === value;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              aria-label={BOARD_BACKGROUNDS[key].label}
              aria-pressed={selected}
              title={BOARD_BACKGROUNDS[key].label}
              className={cn(
                'flex h-8 items-center justify-center rounded bg-linear-to-br text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60',
                BOARD_BACKGROUNDS[key].className,
                selected && 'ring-2 ring-brand ring-offset-1',
              )}
            >
              {selected && <Check size={14} strokeWidth={3} />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
