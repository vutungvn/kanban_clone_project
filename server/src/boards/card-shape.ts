import type { Attachment, Prisma } from '@prisma/client';
import { previewUrl } from '../storage/files';

/** Sắp theo position, trùng thì theo thời điểm tạo — dùng cho list, card, checklist, mục checklist. */
export const byPosition = [{ position: 'asc' }, { createdAt: 'asc' }] as const satisfies Prisma.CardOrderByWithRelationInput[];

/** Quan hệ cần đọc kèm mỗi thẻ để trả về CardDto. */
export const cardInclude = {
  labels: { select: { labelId: true }, orderBy: { label: { createdAt: 'asc' } } },
  members: { select: { userId: true }, orderBy: { createdAt: 'asc' } },
  checklists: { orderBy: byPosition, include: { items: { orderBy: byPosition } } },
  attachments: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
  _count: { select: { activities: { where: { type: 'COMMENT' } } } },
} as const satisfies Prisma.CardInclude;

/** Tệp đính kèm → dạng trả về cho client (ẩn storageKey, thêm ảnh thu nhỏ). */
export const toAttachment = ({ storageKey: _storageKey, ...attachment }: Attachment) => ({
  ...attachment,
  previewUrl: previewUrl(attachment),
});

type CardWithRelations = Prisma.CardGetPayload<{ include: typeof cardInclude }>;

/** Card + quan hệ → dạng trả về cho client: nhãn / thành viên chỉ gửi id (chi tiết nằm ở board.labels / board.members). */
export const toCard = ({ labels, members, attachments, _count, ...card }: CardWithRelations) => ({
  ...card,
  labelIds: labels.map((l) => l.labelId),
  memberIds: members.map((m) => m.userId),
  attachments: attachments.map(toAttachment),
  commentCount: _count.activities,
});

/** Lọc bỏ thẻ / danh sách đã lưu trữ. */
export const notArchived = { archivedAt: null } as const;

/** Danh sách kèm thẻ (chưa lưu trữ) đã sắp xếp. */
export const listInclude = {
  cards: { where: notArchived, orderBy: byPosition, include: cardInclude },
} as const satisfies Prisma.ListInclude;

type ListWithCards = Prisma.ListGetPayload<{ include: typeof listInclude }>;

export const toList = ({ cards, ...list }: ListWithCards) => ({ ...list, cards: cards.map(toCard) });
