'use client';

import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { Popover, PopoverHeader, usePopoverAnchor } from '@/components/popover';
import { ComingSoonBadge } from '@/components/ui';
import type { List } from '@/lib/boards-api';
import { cn } from '@/lib/cn';
import type { BoardActions } from '@/lib/use-board';
import { CardItem } from './card-item';
import { AddCardComposer } from './composers';
import type { DragData } from './dnd';
import { InlineTitle } from './inline-title';

const COLUMN_CLASS = 'flex max-h-full w-68 shrink-0 flex-col rounded-xl p-2.5';

export function ListColumn({
  list,
  totalCards,
  canEdit,
  canDragCards = canEdit,
  actions,
}: {
  list: List;
  /** Đang lọc: tổng số thẻ thật của danh sách (list.cards chỉ còn thẻ khớp) */
  totalCards?: number;
  canEdit: boolean;
  canDragCards?: boolean;
  actions: BoardActions;
}) {
  const [composerOpen, setComposerOpen] = useState(false);
  const cardsRef = useRef<HTMLOListElement>(null);
  const menu = usePopoverAnchor();
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: list.id,
    data: { type: 'list', title: list.title } satisfies DragData,
    disabled: !canEdit,
  });
  // Bỏ role="button" mặc định: phần tiêu đề còn chứa nút khác, lồng button trong button là sai chuẩn
  const { role: _role, ...handleAttributes } = attributes;

  // Thẻ mới nằm cuối danh sách → cuộn xuống để thấy
  const scrollToBottom = () =>
    requestAnimationFrame(() => cardsRef.current?.scrollTo({ top: cardsRef.current.scrollHeight, behavior: 'smooth' }));

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      aria-label={`Danh sách ${list.title}`}
      // Đang kéo: chỗ cũ thành khung trống (bản kéo theo chuột nằm ở DragOverlay)
      className={cn(COLUMN_CLASS, isDragging ? 'bg-black/20 *:invisible' : 'bg-list shadow-md')}
    >
      {/* Tiêu đề là "tay cầm" để kéo cả danh sách */}
      <div
        ref={setActivatorNodeRef}
        {...handleAttributes}
        {...listeners}
        aria-label={canEdit ? `Kéo để di chuyển danh sách "${list.title}"` : undefined}
        className={cn('flex items-start justify-between gap-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand', canEdit && 'cursor-grab')}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <InlineTitle
            value={list.title}
            editable={canEdit}
            label="tên danh sách"
            maxLength={100}
            onSave={(title) => void actions.renameList(list.id, title)}
            className="rounded px-2 py-1 text-sm font-semibold wrap-break-word text-ink hover:bg-black/5"
            inputClassName="h-8 w-full bg-white px-2 text-sm font-semibold text-ink ring-2 ring-brand"
          />
          <span
            title={totalCards === undefined ? undefined : `${list.cards.length} trên ${totalCards} thẻ khớp bộ lọc`}
            className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-semibold text-ink-subtle"
          >
            {totalCards === undefined ? list.cards.length : `${list.cards.length}/${totalCards}`}
          </span>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={menu.toggle}
            aria-label={`Thao tác với danh sách "${list.title}"`}
            aria-haspopup="dialog"
            aria-expanded={!!menu.anchor}
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-subtle transition-colors hover:bg-black/10 aria-expanded:bg-black/10"
          >
            <MoreHorizontal size={18} />
          </button>
        )}
      </div>

      <SortableContext items={list.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        {/* min-h-2: danh sách trống vẫn có chỗ để thả thẻ vào */}
        <ol ref={cardsRef} className="mt-1 flex min-h-2 flex-1 flex-col gap-2 overflow-y-auto p-0.5">
          {list.cards.map((card) => (
            <CardItem key={card.id} card={card} canEdit={canEdit} canDrag={canDragCards} actions={actions} />
          ))}
        </ol>
      </SortableContext>

      {canEdit &&
        (composerOpen ? (
          <AddCardComposer
            onAdd={(title) => actions.addCard(list.id, title)}
            onAdded={scrollToBottom}
            onClose={() => setComposerOpen(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-ink-subtle transition-colors hover:bg-black/5 hover:text-ink"
          >
            <Plus size={18} />
            Thêm thẻ
          </button>
        ))}

      <ListMenu
        list={list}
        anchor={menu.anchor}
        onClose={menu.close}
        onAddCard={() => {
          menu.close();
          setComposerOpen(true);
        }}
        onDelete={() => {
          menu.close();
          void actions.deleteList(list.id);
        }}
      />
    </section>
  );
}

/** Bản sao danh sách bay theo con trỏ khi kéo. */
export function ListPreview({ list }: { list: List }) {
  return (
    <section className={cn(COLUMN_CLASS, 'max-h-[70vh] rotate-2 bg-list cursor-grabbing overflow-hidden shadow-2xl')}>
      <div className="flex items-center gap-2 px-2 py-1">
        <h2 className="text-sm font-semibold wrap-break-word text-ink">{list.title}</h2>
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-semibold text-ink-subtle">{list.cards.length}</span>
      </div>
      <ol className="mt-1 flex flex-col gap-2 p-0.5">
        {list.cards.map((card) => (
          <li key={card.id} className="rounded-lg bg-white p-3 text-sm wrap-break-word text-ink shadow-sm">
            {card.title}
          </li>
        ))}
      </ol>
    </section>
  );
}

const MENU_ITEM ='flex w-full items-center rounded px-2.5 py-1.5 text-left text-sm transition-colors';

function ListMenu({
  list,
  anchor,
  onClose,
  onAddCard,
  onDelete,
}: {
  list: List;
  anchor: HTMLElement | null;
  onClose: () => void;
  onAddCard: () => void;
  onDelete: () => void;
}) {
  return (
    <Popover anchor={anchor} onClose={onClose} label="Thao tác với danh sách">
      <ListMenuContent list={list} onClose={onClose} onAddCard={onAddCard} onDelete={onDelete} />
    </Popover>
  );
}

function ListMenuContent({
  list,
  onClose,
  onAddCard,
  onDelete,
}: {
  list: List;
  onClose: () => void;
  onAddCard: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    const count = list.cards.length;
    return (
      <>
        <PopoverHeader title="Xoá danh sách?" onClose={onClose} />
        <p className="px-1 text-sm text-ink-subtle">
          Danh sách <strong className="text-ink">&quot;{list.title}&quot;</strong>
          {count > 0 && <> cùng {count} thẻ bên trong</>} sẽ bị xoá vĩnh viễn và không thể khôi phục.
        </p>
        <button
          type="button"
          onClick={onDelete}
          className="mt-3 h-9 w-full rounded bg-danger text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Xoá danh sách
        </button>
      </>
    );
  }

  return (
    <>
      <PopoverHeader title="Thao tác" onClose={onClose} />
      <button type="button" onClick={onAddCard} className={`${MENU_ITEM} hover:bg-list`}>
        Thêm thẻ...
      </button>
      {['Sao chép danh sách...', 'Di chuyển danh sách...'].map((label) => (
        <UpcomingItem key={label} label={label} />
      ))}
      <hr className="my-1.5 border-surface-high" />
      <UpcomingItem label="Sắp xếp theo..." />
      <hr className="my-1.5 border-surface-high" />
      <UpcomingItem label="Lưu trữ danh sách này" />
      <button type="button" onClick={() => setConfirming(true)} className={`${MENU_ITEM} text-danger hover:bg-danger-soft/40`}>
        Xoá danh sách này
      </button>
    </>
  );
}

function UpcomingItem({ label }: { label: string }) {
  return (
    <button type="button" disabled className={`${MENU_ITEM} cursor-not-allowed justify-between text-ink/50`}>
      {label}
      <ComingSoonBadge />
    </button>
  );
}
