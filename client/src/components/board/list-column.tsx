'use client';

import { MoreHorizontal, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { Popover, PopoverHeader, usePopoverAnchor } from '@/components/popover';
import { ComingSoonBadge } from '@/components/ui';
import type { List } from '@/lib/boards-api';
import type { BoardActions } from '@/lib/use-board';
import { CardItem } from './card-item';
import { AddCardComposer } from './composers';
import { InlineTitle } from './inline-title';

export function ListColumn({ list, canEdit, actions }: { list: List; canEdit: boolean; actions: BoardActions }) {
  const [composerOpen, setComposerOpen] = useState(false);
  const cardsRef = useRef<HTMLOListElement>(null);
  const menu = usePopoverAnchor();

  // Thẻ mới nằm cuối danh sách → cuộn xuống để thấy
  const scrollToBottom = () =>
    requestAnimationFrame(() => cardsRef.current?.scrollTo({ top: cardsRef.current.scrollHeight, behavior: 'smooth' }));

  return (
    <section
      aria-label={`Danh sách ${list.title}`}
      className="flex max-h-full w-68 shrink-0 flex-col rounded-xl bg-list p-2.5 shadow-md"
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <InlineTitle
            value={list.title}
            editable={canEdit}
            label="tên danh sách"
            maxLength={100}
            onSave={(title) => void actions.renameList(list.id, title)}
            className="rounded px-2 py-1 text-sm font-semibold break-words text-ink hover:bg-black/5"
            inputClassName="h-8 w-full bg-white px-2 text-sm font-semibold text-ink ring-2 ring-brand"
          />
          <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-semibold text-ink-subtle">
            {list.cards.length}
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

      <ol ref={cardsRef} className="mt-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-0.5">
        {list.cards.map((card) => (
          <CardItem key={card.id} card={card} canEdit={canEdit} actions={actions} />
        ))}
      </ol>

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

const MENU_ITEM = 'flex w-full items-center rounded px-2.5 py-1.5 text-left text-sm transition-colors';

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
