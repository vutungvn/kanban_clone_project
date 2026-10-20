'use client';

import { ChevronDown } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { PopoverHeader } from '@/components/popover';
import type { Card, CardInput } from '@/lib/boards-api';
import {
  addDays,
  DUE_STATUS_CLASS,
  DUE_STATUS_LABEL,
  dueStatus,
  formatDay,
  formatDayTime,
  fromInputs,
  toDateInput,
  toTimeInput,
} from '@/lib/card-dates';
import { cn } from '@/lib/cn';
import { PRIMARY_BUTTON, SECONDARY_BUTTON, TEXT_INPUT } from './card-ui';

const CHECKBOX = 'h-4 w-4 shrink-0 accent-brand';

/**
 * Popover "Ngày": ngày bắt đầu (chỉ ngày) + hạn chót (ngày + giờ), mỗi loại bật / tắt bằng ô tích.
 * Giờ tính theo máy người dùng; gửi lên server dạng ISO (UTC).
 */
export function DatesPopoverContent({
  card,
  onSave,
  onClose,
}: {
  card: Card;
  onSave: (input: CardInput) => void;
  onClose: () => void;
}) {
  const today = new Date();
  const due = card.dueDate ? new Date(card.dueDate) : null;
  const start = card.startDate ? new Date(card.startDate) : null;
  // Chưa có ngày nào: bật sẵn hạn chót = ngày mai 12:00 (giống Trello)
  const defaultDue = new Date(addDays(today, 1).setHours(12, 0, 0, 0));

  const [startOn, setStartOn] = useState(!!start);
  const [startDay, setStartDay] = useState(toDateInput(start ?? (due && due < today ? due : today)));
  const [dueOn, setDueOn] = useState(!!due || !start);
  const [dueDay, setDueDay] = useState(toDateInput(due ?? defaultDue));
  const [dueTime, setDueTime] = useState(toTimeInput(due ?? defaultDue));
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const nextStart = startOn ? fromInputs(startDay) : null;
    const nextDue = dueOn ? fromInputs(dueDay, dueTime) : null;
    if ((startOn && !nextStart) || (dueOn && !nextDue)) return setError('Ngày hoặc giờ không hợp lệ');
    if (nextStart && nextDue && nextStart > nextDue) return setError('Ngày bắt đầu phải trước hoặc bằng hạn chót');
    onSave({ startDate: nextStart?.toISOString() ?? null, dueDate: nextDue?.toISOString() ?? null });
    onClose();
  }

  return (
    <>
      <PopoverHeader title="Ngày" onClose={onClose} />
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-xs font-semibold text-ink-subtle">Ngày bắt đầu</legend>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={startOn}
              onChange={(e) => {
                setStartOn(e.target.checked);
                setError(null);
              }}
              aria-label="Có ngày bắt đầu"
              className={CHECKBOX}
            />
            <input
              type="date"
              value={startDay}
              disabled={!startOn}
              onChange={(e) => {
                setStartDay(e.target.value);
                setError(null);
              }}
              aria-label="Ngày bắt đầu"
              className={TEXT_INPUT}
            />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-xs font-semibold text-ink-subtle">Ngày hết hạn</legend>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={dueOn}
              onChange={(e) => {
                setDueOn(e.target.checked);
                setError(null);
              }}
              aria-label="Có hạn chót"
              className={CHECKBOX}
            />
            <div className="min-w-0 flex-1">
              <input
                type="date"
                value={dueDay}
                disabled={!dueOn}
                onChange={(e) => {
                  setDueDay(e.target.value);
                  setError(null);
                }}
                aria-label="Ngày hết hạn"
                className={TEXT_INPUT}
              />
            </div>
            <div className="w-30 shrink-0">
              <input
                type="time"
                value={dueTime}
                disabled={!dueOn}
                onChange={(e) => {
                  setDueTime(e.target.value);
                  setError(null);
                }}
                aria-label="Giờ hết hạn"
                className={TEXT_INPUT}
              />
            </div>
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="-mt-2 text-xs font-medium text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button type="submit" className={cn(PRIMARY_BUTTON, 'h-9 w-full')}>
            Lưu
          </button>
          {(card.startDate || card.dueDate) && (
            <button
              type="button"
              onClick={() => {
                onSave({ startDate: null, dueDate: null });
                onClose();
              }}
              className={cn(SECONDARY_BUTTON, 'h-9 w-full')}
            >
              Gỡ bỏ
            </button>
          )}
        </div>
      </form>
    </>
  );
}

/**
 * Mục "Ngày" ở đầu modal: ô tích hoàn thành (khi có hạn chót) + nút mở popover sửa ngày.
 * Người xem: chỉ hiển thị.
 */
export function CardDatesField({
  card,
  canEdit,
  expanded,
  onOpen,
  onToggleComplete,
}: {
  card: Card;
  canEdit: boolean;
  expanded: boolean;
  onOpen: (e: React.MouseEvent<HTMLElement>) => void;
  onToggleComplete: (complete: boolean) => void;
}) {
  const status = dueStatus(card);
  const statusLabel = status ? DUE_STATUS_LABEL[status] : null;
  const text =
    card.startDate && card.dueDate
      ? `${formatDay(card.startDate)} - ${formatDayTime(card.dueDate)}`
      : card.dueDate
        ? formatDayTime(card.dueDate)
        : formatDay(card.startDate!);

  const content = (
    <>
      {text}
      {statusLabel && (
        <span className={cn('rounded-sm px-1 text-xs font-semibold', status && DUE_STATUS_CLASS[status])}>{statusLabel}</span>
      )}
    </>
  );

  return (
    <div className="flex items-center gap-1.5">
      {card.dueDate && (
        <input
          type="checkbox"
          checked={card.dueComplete}
          disabled={!canEdit}
          onChange={(e) => onToggleComplete(e.target.checked)}
          aria-label="Đánh dấu hoàn thành hạn chót"
          className={cn(CHECKBOX, 'disabled:cursor-not-allowed')}
        />
      )}
      {canEdit ? (
        <button
          type="button"
          onClick={onOpen}
          aria-haspopup="dialog"
          aria-expanded={expanded}
          aria-label={`Ngày: ${text}${statusLabel ? ` (${statusLabel})` : ''}. Bấm để sửa`}
          className="flex h-8 items-center gap-1.5 rounded bg-surface-low px-3 text-sm font-medium transition-colors hover:bg-surface-mid aria-expanded:bg-surface-high"
        >
          {content}
          <ChevronDown size={16} className="text-ink-subtle" />
        </button>
      ) : (
        <span className="flex h-8 items-center gap-1.5 rounded bg-surface-low px-3 text-sm font-medium">{content}</span>
      )}
    </div>
  );
}
