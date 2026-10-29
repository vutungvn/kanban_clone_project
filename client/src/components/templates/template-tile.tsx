import type { ReactNode } from 'react';
import { backgroundClass } from '@/lib/board-backgrounds';
import { cn } from '@/lib/cn';
import { templateMeta, type TemplateSummary } from '@/lib/templates-api';

/** Chiều cao các cột thu nhỏ — so le cho giống bảng thật */
const MINI_HEIGHTS = ['h-10', 'h-14', 'h-8', 'h-12'];
const MAX_MINI_LISTS = 4;

/** Ô mẫu trên trang Mẫu: phông nền + các cột thu nhỏ, tên, mô tả, số danh sách / thẻ. `action`: nút góc phải (mẫu của tôi). */
export function TemplateTile({ template, onOpen, action }: { template: TemplateSummary; onOpen: () => void; action?: ReactNode }) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl bg-card shadow-[0_0_0_1px_var(--color-hairline)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(9,30,66,0.15),0_0_0_1px_var(--color-hairline)]">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 flex-col text-left outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
      >
        <span aria-hidden className={cn('flex h-24 shrink-0 items-start gap-1.5 bg-linear-to-br px-3 pt-3', backgroundClass(template.background))}>
          {template.lists.slice(0, MAX_MINI_LISTS).map((title, i) => (
            <span key={i} className={cn('flex w-1/4 flex-col gap-1 rounded-sm bg-card/75 p-1', MINI_HEIGHTS[i])}>
              <span className="h-1.5 w-3/4 rounded-full bg-ink/25" />
            </span>
          ))}
        </span>
        <span className="flex flex-1 flex-col gap-1 p-3">
          <span className="line-clamp-1 pr-6 text-sm font-semibold text-ink">{template.title}</span>
          {template.description && <span className="line-clamp-2 text-xs text-ink-subtle">{template.description}</span>}
          <span className="mt-auto pt-1 text-[11px] text-ink-subtle">{templateMeta(template)}</span>
        </span>
      </button>
      {action && <div className="absolute top-26 right-1.5">{action}</div>}
    </div>
  );
}
