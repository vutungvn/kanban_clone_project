'use client';

import { CalendarX, Clock, CircleCheck, Tag, UserRoundX } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Avatar } from '@/components/avatar';
import { PopoverHeader } from '@/components/popover';
import type { BoardDetail } from '@/lib/boards-api';
import { EMPTY_FILTER, filterCount, NONE, type CardFilter, type DueFilter } from '@/lib/card-filter';
import { cn } from '@/lib/cn';
import { labelDisplayName } from '@/lib/labels';
import { LabelChip, POPOVER_SECTION, TEXT_INPUT } from './card-ui';

const ICON_BOX = 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full';

const DUE_OPTIONS: { value: DueFilter; label: string; icon: ReactNode }[] = [
  { value: 'none', label: 'Không có ngày hết hạn', icon: <span className={cn(ICON_BOX, 'bg-surface-mid text-ink-subtle')}><CalendarX size={14} /></span> },
  { value: 'overdue', label: 'Quá hạn', icon: <span className={cn(ICON_BOX, 'bg-danger text-white')}><Clock size={14} /></span> },
  { value: 'day', label: 'Hết hạn trong 24 giờ tới', icon: <span className={cn(ICON_BOX, 'bg-[#f5cd47] text-ink')}><Clock size={14} /></span> },
  { value: 'week', label: 'Hết hạn trong 7 ngày tới', icon: <span className={cn(ICON_BOX, 'bg-surface-mid text-ink-subtle')}><Clock size={14} /></span> },
  { value: 'complete', label: 'Đã đánh dấu hoàn thành', icon: <span className={cn(ICON_BOX, 'bg-success text-white')}><CircleCheck size={14} /></span> },
];

/** Thêm / bỏ 1 giá trị khỏi nhóm lọc. */
const toggle = <T,>(values: T[], value: T, on: boolean) => (on ? [...values, value] : values.filter((v) => v !== value));

/** Popover "Lọc thẻ": từ khoá, thành viên, ngày hết hạn, nhãn. Áp dụng ngay khi tích. */
export function CardFilterPopoverContent({
  board,
  filter,
  onChange,
  onClose,
}: {
  board: BoardDetail;
  filter: CardFilter;
  onChange: (filter: CardFilter) => void;
  onClose: () => void;
}) {
  const meId = useAuth().user?.id;
  // Mình lên đầu, giống Trello ("Thẻ giao cho tôi")
  const members = [...board.members].sort((a, b) => Number(b.id === meId) - Number(a.id === meId));

  return (
    <>
      <PopoverHeader title="Lọc thẻ" onClose={onClose} />
      <div className="-mx-3 max-h-[min(70vh,560px)] overflow-y-auto px-3 pb-1">
        <label className="text-xs font-semibold text-ink-subtle">
          Từ khoá
          <input
            autoFocus
            value={filter.keyword}
            onChange={(e) => onChange({ ...filter, keyword: e.target.value })}
            placeholder="Nhập từ khoá..."
            className={cn(TEXT_INPUT, 'mt-1 font-normal')}
          />
        </label>
        <p className="mt-1 text-[11px] text-ink-subtle">Tìm theo tiêu đề, mô tả, nhãn và thành viên của thẻ.</p>

        <h3 className={POPOVER_SECTION}>Thành viên</h3>
        <OptionRow
          checked={filter.members.includes(NONE)}
          onChange={(on) => onChange({ ...filter, members: toggle(filter.members, NONE, on) })}
        >
          <span className={cn(ICON_BOX, 'bg-surface-mid text-ink-subtle')}>
            <UserRoundX size={14} />
          </span>
          Không có thành viên
        </OptionRow>
        {members.map((m) => (
          <OptionRow
            key={m.id}
            checked={filter.members.includes(m.id)}
            onChange={(on) => onChange({ ...filter, members: toggle(filter.members, m.id, on) })}
          >
            <Avatar name={m.name} seed={m.id} size={24} />
            <span className="truncate">{m.id === meId ? 'Thẻ giao cho tôi' : m.name}</span>
          </OptionRow>
        ))}

        <h3 className={POPOVER_SECTION}>Ngày hết hạn</h3>
        {DUE_OPTIONS.map((o) => (
          <OptionRow
            key={o.value}
            checked={filter.due.includes(o.value)}
            onChange={(on) => onChange({ ...filter, due: toggle(filter.due, o.value, on) })}
          >
            {o.icon}
            {o.label}
          </OptionRow>
        ))}

        <h3 className={POPOVER_SECTION}>Nhãn</h3>
        <OptionRow
          checked={filter.labels.includes(NONE)}
          onChange={(on) => onChange({ ...filter, labels: toggle(filter.labels, NONE, on) })}
        >
          <span className={cn(ICON_BOX, 'bg-surface-mid text-ink-subtle')}>
            <Tag size={14} />
          </span>
          Không có nhãn
        </OptionRow>
        {board.labels.map((l) => (
          <OptionRow
            key={l.id}
            checked={filter.labels.includes(l.id)}
            onChange={(on) => onChange({ ...filter, labels: toggle(filter.labels, l.id, on) })}
            label={labelDisplayName(l)}
          >
            <LabelChip label={l} size="sm" className="w-full" />
          </OptionRow>
        ))}
      </div>

      {filterCount(filter) > 0 && (
        <>
          <hr className="-mx-3 my-2 border-surface-high" />
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTER)}
            className="h-8 w-full rounded bg-surface-mid text-sm font-medium transition-colors hover:bg-surface-high"
          >
            Xoá bộ lọc
          </button>
        </>
      )}
    </>
  );
}

function OptionRow({
  checked,
  onChange,
  label,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Tên cho trình đọc màn hình khi nội dung không có chữ (vd nhãn không tên) */
  label?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded px-1 text-sm transition-colors hover:bg-surface-low">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        className="h-4 w-4 shrink-0 accent-brand"
      />
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
    </label>
  );
}
