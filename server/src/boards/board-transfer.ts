import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;
type LabelLike = { id: string; name: string; color: string };

const labelKey = (label: { name: string; color: string }) => `${label.name}\u0000${label.color}`;

/**
 * Ghép nhãn của bảng nguồn với nhãn cùng tên + cùng màu ở bảng đích; chưa có thì tạo mới.
 * Trả về Map: id nhãn nguồn → id nhãn ở bảng đích.
 */
export async function mapLabelsToBoard(tx: Tx, labels: LabelLike[], targetBoardId: string) {
  const map = new Map<string, string>();
  if (!labels.length) return map;
  const existing = await tx.label.findMany({ where: { boardId: targetBoardId }, select: { id: true, name: true, color: true } });
  const byKey = new Map(existing.map((l) => [labelKey(l), l.id]));
  let created = 0;
  for (const label of labels) {
    if (map.has(label.id)) continue;
    let id = byKey.get(labelKey(label));
    if (!id) {
      // createdAt lệch nhau 1ms để giữ thứ tự nhãn như bảng nguồn
      const copy = await tx.label.create({
        data: { boardId: targetBoardId, name: label.name, color: label.color, createdAt: new Date(Date.now() + created++) },
      });
      id = copy.id;
      byKey.set(labelKey(label), id);
    }
    map.set(label.id, id);
  }
  return map;
}

export async function boardMemberIds(tx: Tx, boardId: string) {
  const members = await tx.boardMember.findMany({ where: { boardId }, select: { userId: true } });
  return new Set(members.map((m) => m.userId));
}

/**
 * Các thẻ vừa được chuyển sang bảng khác (listId đã đổi) → làm cho khớp bảng đích:
 * - nhãn: đổi sang nhãn cùng tên + màu của bảng đích
 * - người được giao: ai không phải thành viên bảng đích thì bị gỡ
 * - lịch sử + thông báo: chuyển sang bảng đích; thông báo của người không còn xem được thẻ thì xoá
 */
export async function rehomeCards(tx: Tx, cardIds: string[], targetBoardId: string) {
  if (!cardIds.length) return;
  const where = { cardId: { in: cardIds } };

  const links = await tx.cardLabel.findMany({ where, include: { label: { select: { id: true, name: true, color: true } } } });
  if (links.length) {
    const map = await mapLabelsToBoard(tx, links.map((l) => l.label), targetBoardId);
    await tx.cardLabel.deleteMany({ where });
    await tx.cardLabel.createMany({
      data: links.map((l) => ({ cardId: l.cardId, labelId: map.get(l.labelId)! })),
      skipDuplicates: true,
    });
  }

  const members = [...(await boardMemberIds(tx, targetBoardId))];
  await tx.cardMember.deleteMany({ where: { ...where, userId: { notIn: members } } });
  await tx.activity.updateMany({ where, data: { boardId: targetBoardId } });
  await tx.notification.deleteMany({ where: { ...where, userId: { notIn: members } } });
  await tx.notification.updateMany({ where, data: { boardId: targetBoardId } });
}
