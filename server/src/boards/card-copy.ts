import type { Prisma } from '@prisma/client';
import { byPosition, cardInclude } from './card-shape';

/** Phần nào của thẻ gốc được giữ khi sao chép (mô tả luôn được giữ; bình luận / lịch sử thì không). */
export interface CopyOptions {
  labels: boolean;
  members: boolean;
  checklists: boolean;
  dates: boolean;
  attachments: boolean;
}

export const COPY_ALL: CopyOptions = { labels: true, members: true, checklists: true, dates: true, attachments: true };

/** Dữ liệu cần đọc từ thẻ gốc để sao chép. */
export const copySourceInclude = {
  labels: { select: { labelId: true, label: { select: { id: true, name: true, color: true } } } },
  members: { select: { userId: true } },
  checklists: { orderBy: byPosition, include: { items: { orderBy: byPosition } } },
  attachments: true,
} as const satisfies Prisma.CardInclude;

export type CopySource = Prisma.CardGetPayload<{ include: typeof copySourceInclude }>;

/**
 * Tạo bản sao của `source` trong danh sách `listId` tại `position`. Màu ảnh bìa luôn giữ; tệp đính kèm dùng chung
 * tệp với thẻ gốc (cùng storageKey), ảnh bìa là ảnh đính kèm thì trỏ sang bản sao của ảnh đó.
 * Sang bảng khác: truyền `labelMap` (nhãn nguồn → nhãn bảng đích, xem mapLabelsToBoard)
 * và `memberIds` (thành viên bảng đích — người được giao không thuộc bảng đích sẽ bị bỏ).
 */
export async function copyCard(
  tx: Prisma.TransactionClient,
  source: CopySource,
  target: {
    listId: string;
    position: number;
    title: string;
    keep: CopyOptions;
    labelMap?: Map<string, string>;
    memberIds?: Set<string>;
  },
) {
  const { keep } = target;
  const card = await tx.card.create({
    data: {
      listId: target.listId,
      title: target.title,
      position: target.position,
      description: source.description,
      coverColor: source.coverColor,
      ...(keep.dates && { startDate: source.startDate, dueDate: source.dueDate, dueComplete: source.dueComplete }),
      labels: keep.labels
        ? { create: source.labels.map((l) => ({ labelId: target.labelMap?.get(l.labelId) ?? l.labelId })) }
        : undefined,
      members: keep.members
        ? {
            create: source.members
              .filter((m) => !target.memberIds || target.memberIds.has(m.userId))
              .map((m) => ({ userId: m.userId })),
          }
        : undefined,
      checklists: keep.checklists
        ? {
            create: source.checklists.map((c) => ({
              title: c.title,
              position: c.position,
              items: { create: c.items.map((i) => ({ title: i.title, completed: i.completed, position: i.position })) },
            })),
          }
        : undefined,
      attachments: keep.attachments
        ? { create: source.attachments.map(({ id: _id, cardId: _cardId, ...file }) => file) }
        : undefined,
    },
    include: cardInclude,
  });

  const cover = keep.attachments && source.attachments.find((a) => a.id === source.coverAttachmentId);
  const coverCopy = cover && card.attachments.find((a) => a.storageKey === cover.storageKey);
  if (!coverCopy) return card;
  return tx.card.update({ where: { id: card.id }, data: { coverAttachmentId: coverCopy.id }, include: cardInclude });
}
