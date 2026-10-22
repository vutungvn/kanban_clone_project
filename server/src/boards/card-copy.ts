import type { Prisma } from '@prisma/client';
import { byPosition, cardInclude } from './card-shape';

/** Phần nào của thẻ gốc được giữ khi sao chép (mô tả luôn được giữ; bình luận / lịch sử thì không). */
export interface CopyOptions {
  labels: boolean;
  members: boolean;
  checklists: boolean;
  dates: boolean;
}

export const COPY_ALL: CopyOptions = { labels: true, members: true, checklists: true, dates: true };

/** Dữ liệu cần đọc từ thẻ gốc để sao chép. */
export const copySourceInclude = {
  labels: { select: { labelId: true } },
  members: { select: { userId: true } },
  checklists: { orderBy: byPosition, include: { items: { orderBy: byPosition } } },
} as const satisfies Prisma.CardInclude;

export type CopySource = Prisma.CardGetPayload<{ include: typeof copySourceInclude }>;

/** Tạo bản sao của `source` trong danh sách `listId` (cùng bảng) tại `position`. */
export function copyCard(
  tx: Prisma.TransactionClient,
  source: CopySource,
  target: { listId: string; position: number; title: string; keep: CopyOptions },
) {
  const { keep } = target;
  return tx.card.create({
    data: {
      listId: target.listId,
      title: target.title,
      position: target.position,
      description: source.description,
      ...(keep.dates && { startDate: source.startDate, dueDate: source.dueDate, dueComplete: source.dueComplete }),
      labels: keep.labels ? { create: source.labels.map((l) => ({ labelId: l.labelId })) } : undefined,
      members: keep.members ? { create: source.members.map((m) => ({ userId: m.userId })) } : undefined,
      checklists: keep.checklists
        ? {
            create: source.checklists.map((c) => ({
              title: c.title,
              position: c.position,
              items: { create: c.items.map((i) => ({ title: i.title, completed: i.completed, position: i.position })) },
            })),
          }
        : undefined,
    },
    include: cardInclude,
  });
}
