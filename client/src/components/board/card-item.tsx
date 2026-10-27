'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Pencil, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Card } from '@/lib/boards-api';
import { cn } from '@/lib/cn';
import type { BoardActions } from '@/lib/use-board';
import { useOutsideClick } from '@/lib/use-outside-click';
import { CardFace, describeCard, useResolvedCard } from './card-badges';
import { useOpenCard } from './card-detail-modal';
import type { DragData } from './dnd';

const CARD_CLASS = 'relative rounded-lg bg-card p-3 text-sm text-ink shadow-sm outline-none';

/** `canDrag`: tắt kéo thả riêng (vd đang lọc thẻ — vị trí hiển thị không khớp vị trí thật). */
export function CardItem({
  card,
  canEdit,
  canDrag = canEdit,
  actions,
}: {
  card: Card;
  canEdit: boolean;
  canDrag?: boolean;
  actions: BoardActions;
}) {
  const [editing, setEditing] = useState(false);
  const openCard = useOpenCard();
  const resolved = useResolvedCard(card);
  const summary = describeCard(card, resolved.labels, resolved.members);
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', listId: card.listId, title: card.title } satisfies DragData,
    disabled: !canDrag || editing,
  });
  const style = { transform: CSS.Translate.toString(transform), transition };

  if (editing) {
    return (
      <li ref={setNodeRef} style={style}>
        <CardQuickEdit card={card} actions={actions} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      // Đang kéo: chỗ cũ thành ô trống màu xám (bản kéo theo chuột nằm ở DragOverlay)
      className={cn('group relative', isDragging && 'rounded-lg bg-black/15 *:invisible')}
    >
      <article
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        aria-label={`Thẻ "${card.title}". ${summary ? `${summary}. ` : ''}Enter để mở${canDrag ? ', Space để kéo' : ''}`}
        onClick={() => openCard(card.id)}
        onKeyDown={(e) => {
          listeners?.onKeyDown?.(e); // Space: bắt đầu kéo bằng bàn phím
          if (e.key === 'Enter' && !isDragging && !e.defaultPrevented) {
            e.preventDefault();
            openCard(card.id);
          }
        }}
        className={cn(
          CARD_CLASS,
          'cursor-pointer transition-shadow hover:shadow-md hover:ring-2 hover:ring-brand focus-visible:ring-2 focus-visible:ring-brand',
        )}
      >
        <CardFace card={card} />
      </article>
      {canEdit && (
        // Sửa nhanh tiêu đề ngay trên thẻ; bàn phím dùng modal (Enter) nên không cần nằm trong thứ tự Tab
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setEditing(true)}
          aria-label={`Sửa nhanh thẻ "${card.title}"`}
          title="Sửa nhanh"
          className="absolute top-1.5 right-1.5 hidden h-7 w-7 items-center justify-center rounded-full bg-surface-low text-ink-subtle transition-colors group-hover:flex hover:bg-surface-high hover:text-ink"
        >
          <Pencil size={14} />
        </button>
      )}
    </li>
  );
}

/** Bản sao thẻ bay theo con trỏ khi kéo — nghiêng nhẹ như Trello. */
export function CardPreview({ card }: { card: Card }) {
  return (
    <article className={cn(CARD_CLASS, 'w-62 rotate-3 cursor-grabbing shadow-xl ring-2 ring-brand/40')}>
      <CardFace card={card} />
    </article>
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
        className="w-full resize-none rounded-lg bg-card p-3 text-sm text-ink shadow-sm ring-2 ring-brand outline-none"
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
            className="flex h-8 items-center gap-1.5 rounded px-2 text-sm text-danger transition-colors hover:bg-danger-soft/40"
          >
            <Trash2 size={16} />
            Xoá
          </button>
        )}
      </div>
    </div>
  );
}
