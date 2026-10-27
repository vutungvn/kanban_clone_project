'use client';

import { Check, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { THEME_OPTIONS, useTheme, type ThemePreference } from '@/lib/theme';
import { AccountCard } from './account-ui';

const ICONS: Record<ThemePreference, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };

/** Màu bản xem trước (cố định, không theo giao diện đang dùng) */
const PREVIEW = {
  light: { bg: '#f9f9ff', header: '#1d3052', list: '#f1f2f4', card: '#ffffff', line: '#c9d0dc' },
  dark: { bg: '#1d2125', header: '#161a1d', list: '#101204', card: '#282e33', line: '#454f59' },
};

/** Tab "Giao diện": sáng / tối / theo hệ thống. */
export function AppearanceSection() {
  const [theme, setTheme] = useTheme();
  return (
    <AccountCard title="Giao diện" description="Chỉ áp dụng cho trình duyệt này.">
      <div role="radiogroup" aria-label="Giao diện" className="grid gap-3 sm:grid-cols-3">
        {THEME_OPTIONS.map(({ value, label }) => {
          const selected = theme === value;
          const Icon = ICONS[value];
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(value)}
              className={cn(
                'overflow-hidden rounded-lg text-left outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-brand',
                selected ? 'shadow-[0_0_0_2px_var(--color-brand)]' : 'shadow-[0_0_0_1px_var(--color-hairline)] hover:shadow-[0_0_0_1px_var(--color-outline)]',
              )}
            >
              <ThemePreview theme={value} />
              <span className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-ink">
                <Icon size={16} className="text-ink-subtle" />
                <span className="flex-1">{label}</span>
                {selected && <Check size={16} className="text-brand" />}
              </span>
            </button>
          );
        })}
      </div>
    </AccountCard>
  );
}

/** Bảng thu nhỏ: header + 2 cột danh sách. "Theo hệ thống": nửa sáng / nửa tối. */
function ThemePreview({ theme }: { theme: ThemePreference }) {
  if (theme === 'system') {
    return (
      <span aria-hidden className="relative block h-20">
        <span className="absolute inset-0 [clip-path:polygon(0_0,100%_0,0_100%)]">
          <MiniBoard colors={PREVIEW.light} />
        </span>
        <span className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">
          <MiniBoard colors={PREVIEW.dark} />
        </span>
      </span>
    );
  }
  return (
    <span aria-hidden className="block h-20">
      <MiniBoard colors={PREVIEW[theme]} />
    </span>
  );
}

function MiniBoard({ colors }: { colors: (typeof PREVIEW)['light'] }) {
  return (
    <span className="flex h-full flex-col" style={{ backgroundColor: colors.bg }}>
      <span className="h-3 shrink-0" style={{ backgroundColor: colors.header }} />
      <span className="flex flex-1 gap-1.5 p-2">
        {[3, 2].map((cards, i) => (
          <span key={i} className="flex w-1/3 flex-col gap-1 rounded p-1" style={{ backgroundColor: colors.list }}>
            {Array.from({ length: cards }, (_, j) => (
              <span key={j} className="block h-2.5 rounded-sm" style={{ backgroundColor: colors.card, boxShadow: `0 0 0 1px ${colors.line}` }} />
            ))}
          </span>
        ))}
      </span>
    </span>
  );
}
