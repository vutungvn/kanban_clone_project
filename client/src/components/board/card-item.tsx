'use client';

import { AlignLeft, Pencil, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Card } from '@/lib/boards-api';
import { cn } from '@/lib/cn';
import type { BoardActions } from '@/lib/use-board';
import { useOutsideClick } from '@/lib/use-outside-click';

export function CardItem({ card, canEdit, actions }: { card: Card; canEdit: boolean; actions: BoardActions }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li>
        <CardQuickEdit card={card} actions={actions} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li>
      <article
        role={canEdit ? 'button' : undefined}
        tabIndex={canEdit ? 0 : undefined}
        aria-label={canEdit ? `Sửa thẻ "${card.title}"` : undefined}
        onClick={canEdit ? () => setEditing(true) : undefined}
        onKeyDown={(e) => {
          if (canEdit && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setEditing(true);
          }
        }}
        className={cn(
          'group relative rounded-lg bg-white p-3 text-sm text-ink shadow-sm outline-none',
          canEdit && 'cursor-pointer transition-shadow hover:shadow-md hover:ring-2 hover:ring-brand focus-visible:ring-2 focus-visible:ring-brand',
        )}
      >
        <p className={cn('break-words whitespace-pre-wrap', canEdit && 'pr-6')}>{card.title}</p>
        {card.description && (
          <span className="mt-2 flex text-ink-subtle" title="Thẻ có mô tả">
            <AlignLeft size={16} />
          </span>
        )}
        {canEdit && (
          <span
            aria-hidden
            className="absolute top-2 right-2 hidden h-6 w-6 items-center justify-center rounded bg-surface-high/80 text-ink-subtle group-hover:flex"
          >
            <Pencil size={14} />
          </span>
        )}
      </article>
    </li>
  );
}

/** Sửa nhanh ngay trên thẻ: đổi tiêu đề hoặc xoá. Bấm ra ngoài = lưu. */
function CardQuickEdit({ card, actions, onDone }: { card: Card; actions: BoardActions; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(card.title);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function save() {
    const next = title.trim();
    if (next && next !== card.title) void actions.updateCard(card.id, { title: next });
    onDone();
  }

  useOutsideClick(ref, save);

  return (
    <div ref={ref} className="flex flex-col gap-2">
      <textarea
        autoFocus
        rows={3}
        value={title}
        maxLength={500}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            save();
          } else if (e.key === 'Escape') {
            onDone();
          }
        }}
        aria-label="Tiêu đề thẻ"
        className="w-full resize-none rounded-lg bg-white p-3 text-sm text-ink shadow-sm ring-2 ring-brand outline-none"
      />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={save}
          className="h-8 rounded bg-brand px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover"
        >
          Lưu
        </button>
        <button
          type="button"
          onClick={onDone}
          aria-label="Huỷ"
          className="flex h-8 w-8 items-center justify-center rounded text-ink-subtle transition-colors hover:bg-black/10 hover:text-ink"
        >
          <X size={20} />
        </button>
        <span className="flex-1" />
        {confirmDelete ? (
          <button
            type="button"
            onClick={() => void actions.deleteCard(card.id)}
            className="h-8 rounded bg-danger px-3 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Xác nhận xoá
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex h-8 items-center gap-1.5 rounded px-2 text-sm text-danger transition-colors hover:bg-danger-soft/50"
          >
            <Trash2 size={16} />
            Xoá
          </button>
        )}
      </div>
    </div>
  );
}
