import type { Prisma } from '@prisma/client';

/** Sắp theo position, trùng thì theo thời điểm tạo — dùng cho list, card, checklist, mục checklist. */
export const byPosition = [{ position: 'asc' }, { createdAt: 'asc' }] as const satisfies Prisma.CardOrderByWithRelationInput[];

/** Quan hệ cần đọc kèm mỗi thẻ để trả về CardDto. */
export const cardInclude = {
  labels: { select: { labelId: true }, orderBy: { label: { createdAt: 'asc' } } },
  members: { select: { userId: true }, orderBy: { createdAt: 'asc' } },
  checklists: { orderBy: byPosition, include: { items: { orderBy: byPosition } } },
} as const satisfies Prisma.CardInclude;

type CardWithRelations = Prisma.CardGetPayload<{ include: typeof cardInclude }>;

/** Card + quan hệ → dạng trả về cho client: nhãn / thành viên chỉ gửi id (chi tiết nằm ở board.labels / board.members). */
export const toCard = ({ labels, members, ...card }: CardWithRelations) => ({
  ...card,
  labelIds: labels.map((l) => l.labelId),
  memberIds: members.map((m) => m.userId),
});

/** Danh sách kèm thẻ đã sắp xếp. */
export const listInclude = {
  cards: { orderBy: byPosition, include: cardInclude },
} as const satisfies Prisma.ListInclude;

type ListWithCards = Prisma.ListGetPayload<{ include: typeof listInclude }>;

export const toList = ({ cards, ...list }: ListWithCards) => ({ ...list, cards: cards.map(toCard) });
