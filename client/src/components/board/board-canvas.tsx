'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { LayoutPanelLeft } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BoardDetail, Card, List } from '@/lib/boards-api';
import type { BoardActions } from '@/lib/use-board';
import { BoardLookupProvider } from './card-badges';
import { CardPreview } from './card-item';
import { AddListComposer } from './composers';
import {
  createCollisionDetection,
  HoldTouchSensor,
  MousePointerSensor,
  screenReaderInstructions,
  type DragData,
} from './dnd';
import { ListColumn, ListPreview } from './list-column';

type Dragging = { type: 'list'; id: string } | { type: 'card'; card: Card } | null;

const listOfCard = (lists: List[], cardId: UniqueIdentifier) => lists.find((l) => l.cards.some((c) => c.id === cardId));

/**
 * Vùng chứa các danh sách + toàn bộ logic kéo thả.
 * Trong lúc kéo: chỉ đổi thứ tự trên giao diện (previewLists).
 * Khi thả: gọi API với vị trí cuối cùng; lỗi thì useBoard tự hoàn tác.
 */
export function BoardCanvas({
  board,
  actions,
  filteredLists,
}: {
  board: BoardDetail;
  actions: BoardActions;
  /** Đang lọc thẻ: danh sách chỉ còn thẻ khớp — kéo thả thẻ tạm tắt (vị trí hiển thị không khớp vị trí thật) */
  filteredLists: List[] | null;
}) {
  const canEdit = board.role !== 'VIEWER';
  const lookup = useMemo(() => ({ labels: board.labels, members: board.members }), [board.labels, board.members]);
  const [dragging, setDragging] = useState<Dragging>(null);

  // Luôn đọc thứ tự mới nhất trong các handler (state React chưa kịp render giữa các sự kiện kéo)
  const listsRef = useRef(board.lists);
  listsRef.current = board.lists;
  const snapshot = useRef<List[] | null>(null);
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const justMovedList = useRef(false);

  const preview = (lists: List[]) => {
    listsRef.current = lists;
    actions.previewLists(lists);
  };

  useEffect(() => {
    requestAnimationFrame(() => {
      justMovedList.current = false;
    });
  }, [board.lists]);

  const sensors = useSensors(
    useSensor(MousePointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(HoldTouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter dành cho "mở sửa thẻ" → chỉ Space để nhấc lên
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  );
  const collisionDetection = useMemo(() => createCollisionDetection(lastOverId, justMovedList), []);

  function onDragStart({ active }: DragStartEvent) {
    snapshot.current = listsRef.current;
    actions.holdSync(true);
    const data = active.data.current as DragData;
    if (data.type === 'list') {
      setDragging({ type: 'list', id: String(active.id) });
    } else {
      const card = listOfCard(listsRef.current, active.id)?.cards.find((c) => c.id === active.id);
      if (card) setDragging({ type: 'card', card });
    }
  }

  /** Thẻ đi qua danh sách khác: chuyển ngay sang danh sách đó để các thẻ khác dạt ra nhường chỗ. */
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || (active.data.current as DragData).type !== 'card') return;
    const lists = listsRef.current;
    const from = listOfCard(lists, active.id);
    const overData = over.data.current as DragData | undefined;
    const to = overData?.type === 'list' ? lists.find((l) => l.id === over.id) : listOfCard(lists, over.id);
    if (!from || !to || from.id === to.id) return;

    const card = from.cards.find((c) => c.id === active.id)!;
    let index = to.cards.length;
    if (overData?.type === 'card') {
      const overIndex = to.cards.findIndex((c) => c.id === over.id);
      const dragged = active.rect.current.translated;
      const below = dragged ? dragged.top > over.rect.top + over.rect.height / 2 : false;
      index = overIndex + (below ? 1 : 0);
    }

    justMovedList.current = true;
    preview(
      lists.map((l) => {
        if (l.id === from.id) return { ...l, cards: l.cards.filter((c) => c.id !== card.id) };
        if (l.id === to.id) {
          const cards = [...l.cards];
          cards.splice(index, 0, { ...card, listId: to.id });
          return { ...l, cards };
        }
        return l;
      }),
    );
  }

  function onDragEnd(event: DragEndEvent) {
    finishDrag(event);
    // Request lưu vị trí đã được gửi → giờ mới áp thay đổi của người khác (nếu có)
    actions.holdSync(false);
  }

  function finishDrag({ active, over }: DragEndEvent) {
    const rollback = snapshot.current;
    snapshot.current = null;
    setDragging(null);
    if (!rollback) return;
    if (!over) {
      preview(rollback);
      return;
    }

    const lists = listsRef.current;

    if ((active.data.current as DragData).type === 'list') {
      const from = lists.findIndex((l) => l.id === active.id);
      const to = lists.findIndex((l) => l.id === over.id);
      if (from < 0 || to < 0 || from === to) return;
      preview(arrayMove(lists, from, to));
      void actions.persistListMove(String(active.id), to, rollback);
      return;
    }

    const list = listOfCard(lists, active.id);
    if (!list) return;
    const from = list.cards.findIndex((c) => c.id === active.id);
    const overIndex = list.cards.findIndex((c) => c.id === over.id);
    const to = overIndex >= 0 ? overIndex : from;
    if (to !== from) {
      preview(lists.map((l) => (l.id === list.id ? { ...l, cards: arrayMove(l.cards, from, to) } : l)));
    }

    // Thả lại đúng chỗ cũ → không cần gọi API
    const original = listOfCard(rollback, active.id);
    const originalIndex = original?.cards.findIndex((c) => c.id === active.id);
    if (original?.id === list.id && originalIndex === to) return;
    void actions.persistCardMove(String(active.id), list.id, to, rollback);
  }

  function onDragCancel() {
    if (snapshot.current) preview(snapshot.current);
    snapshot.current = null;
    setDragging(null);
    actions.holdSync(false);
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Đã nhấc ${describe(active.data.current)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${describe(active.data.current)} đang ở trên ${describe(over.data.current)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `Đã thả ${describe(active.data.current)}.` : `Đã thả ${describe(active.data.current)} ra ngoài, không thay đổi.`,
    onDragCancel: ({ active }) => `Đã huỷ kéo ${describe(active.data.current)}.`,
  };

  const empty = board.lists.length === 0;
  const draggingList = dragging?.type === 'list' ? board.lists.find((l) => l.id === dragging.id) : undefined;

  return (
    <BoardLookupProvider value={lookup}>
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      // Danh sách đổi chiều cao liên tục khi thẻ chuyển qua lại → đo lại mọi lúc
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      accessibility={{ announcements, screenReaderInstructions }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      {/* Canvas: cuộn ngang; mỗi cột tự cuộn dọc. Kéo sát mép sẽ tự cuộn. */}
      <div className="flex min-h-0 flex-1 items-start gap-3 overflow-x-auto px-4 pt-3 pb-4">
        <SortableContext items={board.lists.map((l) => l.id)} strategy={horizontalListSortingStrategy}>
          {(filteredLists ?? board.lists).map((list) => (
            <ListColumn
              key={list.id}
              list={list}
              totalCards={filteredLists ? board.lists.find((l) => l.id === list.id)?.cards.length : undefined}
              canEdit={canEdit}
              canDragCards={canEdit && !filteredLists}
              actions={actions}
            />
          ))}
        </SortableContext>

        {canEdit && <AddListComposer onAdd={actions.addList} hasLists={!empty} defaultOpen={empty} />}

        {empty &&
          (canEdit ? (
            <div className="flex w-68 shrink-0 flex-col items-center gap-1.5 rounded-xl border border-dashed border-white/40 bg-white/10 px-4 py-6 text-center text-white/80">
              <LayoutPanelLeft size={22} />
              <p className="text-[11px] font-semibold tracking-wider uppercase">Bảng còn trống</p>
              <p className="text-xs">Tạo danh sách đầu tiên như &quot;Cần làm&quot;, &quot;Đang làm&quot; hoặc &quot;Hoàn thành&quot;.</p>
            </div>
          ) : (
            <p className="rounded-lg bg-black/20 px-4 py-3 text-sm text-white">Bảng chưa có danh sách nào.</p>
          ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {dragging?.type === 'card' && <CardPreview card={dragging.card} />}
        {draggingList && <ListPreview list={draggingList} />}
      </DragOverlay>
    </DndContext>
    </BoardLookupProvider>
  );
}

function describe(data: unknown) {
  const d = data as DragData | undefined;
  if (!d) return 'mục';
  return d.type === 'list' ? `danh sách "${d.title}"` : `thẻ "${d.title}"`;
}
