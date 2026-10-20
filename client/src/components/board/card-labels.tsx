'use client';

import { Check, Pencil } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { PopoverHeader } from '@/components/popover';
import { errorMessage } from '@/lib/api';
import type { BoardDetail, Card, Label } from '@/lib/boards-api';
import { cn } from '@/lib/cn';
import { LABEL_COLORS, labelColor, labelDisplayName, MAX_LABEL_NAME, type LabelColor } from '@/lib/labels';
import { matchesQuery } from '@/lib/search';
import type { BoardActions } from '@/lib/use-board';
import { DANGER_BUTTON, LabelChip, POPOVER_SECTION, PRIMARY_BUTTON, TEXT_INPUT } from './card-ui';

type View = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; label: Label } | { kind: 'delete'; label: Label };

/**
 * Popover "Nhãn" của thẻ: tích để gắn / gỡ, tạo nhãn mới (tự gắn vào thẻ), sửa / xoá nhãn của bảng.
 * Nhãn dùng chung cả bảng → sửa / xoá ảnh hưởng mọi thẻ.
 */
export function LabelsPopoverContent({
  board,
  card,
  actions,
  onClose,
}: {
  board: BoardDetail;
  card: Card;
  actions: BoardActions;
  onClose: () => void;
}) {
  const [view, setView] = useState<View>({ kind: 'list' });
  const back = () => setView({ kind: 'list' });

  if (view.kind === 'delete') {
    return (
      <>
        <PopoverHeader title="Xoá nhãn?" onClose={onClose} onBack={() => setView({ kind: 'edit', label: view.label })} />
        <p className="px-1 text-sm text-ink-subtle">
          Nhãn <strong className="text-ink">{labelDisplayName(view.label)}</strong> sẽ bị gỡ khỏi mọi thẻ trong bảng và không
          thể khôi phục.
        </p>
        <button
          type="button"
          onClick={() => {
            back();
            void actions.deleteLabel(view.label.id);
          }}
          className={cn(DANGER_BUTTON, 'mt-3')}
        >
          Xoá nhãn
        </button>
      </>
    );
  }

  if (view.kind === 'create' || view.kind === 'edit') {
    const editing = view.kind === 'edit' ? view.label : null;
    return (
      <LabelEditor
        key={editing?.id ?? 'new'}
        initial={editing}
        onClose={onClose}
        onBack={back}
        onDelete={editing ? () => setView({ kind: 'delete', label: editing }) : undefined}
        onSave={async (input) => {
          if (editing) {
            if (input.name !== editing.name || input.color !== editing.color) void actions.updateLabel(editing.id, input);
          } else {
            const label = await actions.createLabel(input);
            void actions.setCardLabel(card.id, label.id, true);
          }
          back();
        }}
      />
    );
  }

  return (
    <LabelList
      board={board}
      card={card}
      onClose={onClose}
      onToggle={(label, on) => void actions.setCardLabel(card.id, label.id, on)}
      onEdit={(label) => setView({ kind: 'edit', label })}
      onCreate={() => setView({ kind: 'create' })}
    />
  );
}

function LabelList({
  board,
  card,
  onClose,
  onToggle,
  onEdit,
  onCreate,
}: {
  board: BoardDetail;
  card: Card;
  onClose: () => void;
  onToggle: (label: Label, on: boolean) => void;
  onEdit: (label: Label) => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState('');
  // Tìm theo tên nhãn hoặc tên màu ("đỏ", "xanh la"...)
  const shown = board.labels.filter((l) => matchesQuery(`${l.name} ${labelColor(l.color).name}`, query));

  return (
    <>
      <PopoverHeader title="Nhãn" onClose={onClose} />
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tìm nhãn..."
        aria-label="Tìm nhãn"
        className={TEXT_INPUT}
      />
      <h3 className={POPOVER_SECTION}>Nhãn</h3>
      {shown.length === 0 ? (
        <p className="px-1 py-2 text-sm text-ink-subtle">
          {board.labels.length === 0 ? 'Bảng chưa có nhãn nào.' : 'Không tìm thấy nhãn phù hợp.'}
        </p>
      ) : (
        <ul className="-mx-1 flex max-h-72 flex-col gap-1 overflow-y-auto px-1 py-0.5">
          {shown.map((label) => {
            const checked = card.labelIds.includes(label.id);
            return (
              <li key={label.id} className="flex items-center gap-1.5">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onToggle(label, e.target.checked)}
                    aria-label={labelDisplayName(label)}
                    className="h-4 w-4 shrink-0 accent-brand"
                  />
                  <LabelChip label={label} className="w-full transition-opacity hover:opacity-85" />
                </label>
                <button
                  type="button"
                  onClick={() => onEdit(label)}
                  aria-label={`Sửa nhãn ${labelDisplayName(label)}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-ink-subtle transition-colors hover:bg-surface-mid hover:text-ink"
                >
                  <Pencil size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" onClick={onCreate} className="mt-3 h-8 w-full rounded bg-surface-mid text-sm font-medium transition-colors hover:bg-surface-high">
        Tạo nhãn mới
      </button>
    </>
  );
}

/** Tạo / sửa nhãn: tên (tuỳ chọn) + màu. */
function LabelEditor({
  initial,
  onSave,
  onBack,
  onClose,
  onDelete,
}: {
  initial: Label | null;
  onSave: (input: { name: string; color: LabelColor }) => Promise<void>;
  onBack: () => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState<LabelColor>((initial?.color as LabelColor) ?? 'green');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), color });
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <>
      <PopoverHeader title={initial ? 'Sửa nhãn' : 'Tạo nhãn'} onClose={onClose} onBack={onBack} />
      <div className="-mx-3 mb-3 flex h-16 items-center justify-center bg-surface-low px-6">
        <LabelChip label={{ name: name.trim(), color }} className="w-full" />
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-subtle">
          Tiêu đề
          <input
            autoFocus
            value={name}
            maxLength={MAX_LABEL_NAME}
            onChange={(e) => setName(e.target.value)}
            placeholder="Để trống nếu chỉ cần màu"
            className={cn(TEXT_INPUT, 'font-normal')}
          />
        </label>
        <fieldset>
          <legend className="mb-1 text-xs font-semibold text-ink-subtle">Chọn màu</legend>
          <div className="grid grid-cols-5 gap-1.5">
            {LABEL_COLORS.map((c) => {
              const selected = c.key === color;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setColor(c.key)}
                  aria-label={`Màu ${c.name}`}
                  aria-pressed={selected}
                  title={c.name}
                  style={{ backgroundColor: c.bg, color: c.fg }}
                  className={cn(
                    'flex h-8 items-center justify-center rounded transition-transform hover:scale-105',
                    selected && 'ring-2 ring-brand ring-offset-1',
                  )}
                >
                  {selected && <Check size={16} />}
                </button>
              );
            })}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="text-xs font-medium text-danger">
            {error}
          </p>
        )}
        <hr className="-mx-3 border-surface-high" />
        <div className="flex items-center justify-between gap-2">
          <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
            {initial ? 'Lưu' : pending ? 'Đang tạo...' : 'Tạo'}
          </button>
          {onDelete && (
            <button type="button" onClick={onDelete} className="h-8 rounded px-3 text-sm font-medium text-danger transition-colors hover:bg-danger-soft/40">
              Xoá
            </button>
          )}
        </div>
      </form>
    </>
  );
}
