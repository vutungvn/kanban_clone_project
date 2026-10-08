import {
  closestCenter,
  getFirstCollision,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  type CollisionDetection,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import type { PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent } from 'react';

/** Dữ liệu gắn vào mỗi phần tử kéo được (useSortable({ data })) */
export type DragData = { type: 'list'; title: string } | { type: 'card'; listId: string; title: string };

/** Không bắt đầu kéo khi thao tác trong ô nhập (bôi đen chữ, đặt con trỏ...) */
function isInteractive(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable="true"], [data-no-dnd]');
}

/** Chuột / bút: kéo sau khi di chuyển 5px — bấm thường vẫn là "click" (mở sửa thẻ, sửa tên...). */
export class MousePointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent: e }: ReactPointerEvent) =>
        e.isPrimary && e.button === 0 && e.pointerType !== 'touch' && !isInteractive(e.target),
    },
  ];
}

/** Cảm ứng: giữ ngón tay ~200ms mới kéo, để vuốt vẫn cuộn được bảng. */
export class HoldTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: 'onTouchStart' as const,
      handler: ({ nativeEvent: e }: ReactTouchEvent) => e.touches.length <= 1 && !isInteractive(e.target),
    },
  ];
}

/**
 * Nhận diện vùng thả:
 * - Kéo danh sách: chỉ so với các danh sách khác (gần tâm nhất).
 * - Kéo thẻ: tìm danh sách đang nằm dưới con trỏ, rồi thẻ gần nhất trong danh sách đó;
 *   danh sách trống thì thả vào chính danh sách.
 * `lastOverId` giữ kết quả lần trước khi tạm thời không chạm gì (tránh nhấp nháy);
 * `justMovedList` = vừa chuyển thẻ sang danh sách khác → giữ nguyên 1 khung hình để layout kịp cập nhật.
 */
export function createCollisionDetection(
  lastOverId: { current: UniqueIdentifier | null },
  justMovedList: { current: boolean },
): CollisionDetection {
  return (args) => {
    const type = (args.active.data.current as DragData | undefined)?.type;

    if (type === 'list') {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((c) => c.data.current?.type === 'list'),
      });
    }

    const hits = pointerWithin(args);
    let overId = getFirstCollision(hits.length > 0 ? hits : rectIntersection(args), 'id');

    if (overId != null) {
      const over = args.droppableContainers.find((c) => c.id === overId);
      if (over?.data.current?.type === 'list') {
        // Giữ cả chính thẻ đang kéo (nếu đã ở danh sách này): con trỏ ở khoảng trống dưới thẻ cuối
        // thì "gần nhất" là chỗ của chính nó → đứng yên ở cuối, không bị nhảy lên trên thẻ cuối.
        const cardsInList = args.droppableContainers.filter(
          (c) => c.data.current?.type === 'card' && c.data.current.listId === overId,
        );
        if (cardsInList.length > 0) {
          overId = closestCenter({ ...args, droppableContainers: cardsInList })[0]?.id ?? overId;
        }
      }
      lastOverId.current = overId;
      return [{ id: overId }];
    }

    if (justMovedList.current) lastOverId.current = args.active.id;
    return lastOverId.current != null ? [{ id: lastOverId.current }] : [];
  };
}

export const screenReaderInstructions = {
  draggable:
    'Nhấn Space để nhấc lên. Dùng phím mũi tên để di chuyển, nhấn Space để thả vào vị trí mới, hoặc Esc để huỷ.',
};
