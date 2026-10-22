'use client';

import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Popover, PopoverHeader, usePopoverAnchor } from '@/components/popover';
import { toast } from '@/components/toast';
import { ComingSoonBadge } from '@/components/ui';
import { errorMessage } from '@/lib/api';
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

      <Popover anchor={menu.anchor} onClose={menu.close} label="Thao tác với danh sách">
        <ListMenuContent
          list={list}
          actions={actions}
          onClose={menu.close}
          onAddCard={() => {
            menu.close();
            setComposerOpen(true);
          }}
        />
      </Popover>
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

const MENU_ITEM = 'flex w-full items-center rounded px-2.5 py-1.5 text-left text-sm transition-colors';

type MenuView = 'menu' | 'copy' | 'archive-cards' | 'delete';

/** Menu "..." của danh sách: thêm thẻ, sao chép, lưu trữ, xoá (mỗi thao tác nguy hiểm có bước xác nhận). */
function ListMenuContent({
  list,
  actions,
  onClose,
  onAddCard,
}: {
  list: List;
  actions: BoardActions;
  onClose: () => void;
  onAddCard: () => void;
}) {
  const [view, setView] = useState<MenuView>('menu');
  const back = () => setView('menu');
  const count = list.cards.length;

  if (view === 'copy') return <CopyListForm list={list} actions={actions} onBack={back} onClose={onClose} />;

  if (view === 'archive-cards') {
    return (
      <>
        <PopoverHeader title="Lưu trữ mọi thẻ?" onClose={onClose} onBack={back} />
        <p className="px-1 text-sm text-ink-subtle">
          {count} thẻ trong danh sách <strong className="text-ink">&quot;{list.title}&quot;</strong> sẽ biến khỏi bảng. Bạn có
          thể khôi phục trong Menu → Mục đã lưu trữ.
        </p>
        <button
          type="button"
          onClick={() => {
            onClose();
            void actions.archiveAllCards(list.id);
          }}
          className="mt-3 h-9 w-full rounded bg-brand text-sm font-medium text-white transition-colors hover:bg-brand-hover"
        >
          Lưu trữ tất cả
        </button>
      </>
    );
  }

  if (view === 'delete') {
    return (
      <>
        <PopoverHeader title="Xoá danh sách?" onClose={onClose} onBack={back} />
        <p className="px-1 text-sm text-ink-subtle">
          Danh sách <strong className="text-ink">&quot;{list.title}&quot;</strong>
          {count > 0 && <> cùng {count} thẻ bên trong</>} sẽ bị xoá vĩnh viễn và không thể khôi phục. Muốn ẩn tạm thời thì
          hãy lưu trữ.
        </p>
        <button
          type="button"
          onClick={() => {
            onClose();
            void actions.deleteList(list.id);
          }}
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
      <button type="button" onClick={() => setView('copy')} className={`${MENU_ITEM} hover:bg-list`}>
        Sao chép danh sách...
      </button>
      <UpcomingItem label="Di chuyển danh sách..." />
      <hr className="my-1.5 border-surface-high" />
      <UpcomingItem label="Sắp xếp theo..." />
      <hr className="my-1.5 border-surface-high" />
      <button
        type="button"
        onClick={() => {
          onClose();
          void actions.archiveList(list.id);
          toast.success(`Đã lưu trữ danh sách "${list.title}". Khôi phục trong Menu → Mục đã lưu trữ.`);
        }}
        className={`${MENU_ITEM} hover:bg-list`}
      >
        Lưu trữ danh sách này
      </button>
      <button
        type="button"
        disabled={count === 0}
        onClick={() => setView('archive-cards')}
        className={`${MENU_ITEM} hover:bg-list disabled:cursor-not-allowed disabled:text-ink/50 disabled:hover:bg-transparent`}
      >
        Lưu trữ mọi thẻ trong danh sách này...
      </button>
      <button type="button" onClick={() => setView('delete')} className={`${MENU_ITEM} text-danger hover:bg-danger-soft/40`}>
        Xoá danh sách này
      </button>
    </>
  );
}

/** Sao chép danh sách: nhập tên (mặc định tên cũ) → bản sao kèm mọi thẻ nằm ngay bên phải. */
function CopyListForm({
  list,
  actions,
  onBack,
  onClose,
}: {
  list: List;
  actions: BoardActions;
  onBack: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(list.title);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = title.trim();
    if (!value) return setError('Vui lòng nhập tên danh sách');
    setPending(true);
    try {
      await actions.copyList(list.id, value);
      onClose();
      toast.success(`Đã sao chép danh sách "${list.title}"`);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <>
      <PopoverHeader title="Sao chép danh sách" onClose={onClose} onBack={onBack} />
      <form noValidate onSubmit={submit} className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-subtle">
          Tên
          <input
            autoFocus
            value={title}
            maxLength={100}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              setTitle(e.target.value);
              setError(null);
            }}
            className="h-9 w-full rounded bg-white px-2.5 text-sm font-normal text-ink shadow-[0_0_0_1px_rgba(9,30,66,0.14)] outline-none focus:shadow-[0_0_0_2px_var(--color-brand)]"
          />
        </label>
        <p className="text-xs text-ink-subtle">
          {list.cards.length > 0 ? `Sao chép kèm ${list.cards.length} thẻ (nhãn, thành viên, checklist, ngày).` : 'Danh sách đang trống.'}
        </p>
        {error && (
          <p role="alert" className="text-xs font-medium text-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="h-9 w-full rounded bg-brand text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          {pending ? 'Đang sao chép...' : 'Tạo danh sách'}
        </button>
      </form>
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
