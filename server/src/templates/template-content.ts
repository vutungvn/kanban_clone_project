import type { Prisma } from '@prisma/client';
import { DEFAULT_LABEL_COLORS, POSITION_GAP } from '../boards/boards.constants';
import { byPosition, notArchived } from '../boards/card-shape';

// Nội dung 1 mẫu bảng — dùng chung cho mẫu có sẵn (builtin-templates.ts) và mẫu của tôi (cột JSON `content`).

export interface TemplateLabel {
  name: string;
  /** Key màu nhãn (LABEL_COLORS) */
  color: string;
}

export interface TemplateChecklist {
  title: string;
  /** Tiêu đề các mục — bảng tạo ra luôn ở trạng thái chưa hoàn thành */
  items: string[];
}

export interface TemplateCard {
  title: string;
  description?: string;
  /** Vị trí nhãn trong `TemplateContent.labels` (không dùng id → mẫu độc lập với bảng gốc) */
  labels?: number[];
  /** Key màu bìa (COVER_COLORS) */
  coverColor?: string;
  checklists?: TemplateChecklist[];
}

export interface TemplateList {
  title: string;
  cards: TemplateCard[];
}

export interface TemplateContent {
  labels: TemplateLabel[];
  lists: TemplateList[];
}

export const MAX_TEMPLATE_LISTS = 30;
export const MAX_TEMPLATE_CARDS = 300;

export const countCards = (content: TemplateContent) => content.lists.reduce((n, list) => n + list.cards.length, 0);

/** Chỉ giữ khung: danh sách + nhãn, bỏ hết thẻ. */
export const withoutCards = (content: TemplateContent): TemplateContent => ({
  labels: content.labels,
  lists: content.lists.map((list) => ({ title: list.title, cards: [] })),
});

/**
 * Chụp bảng thành nội dung mẫu: danh sách / thẻ chưa lưu trữ (theo thứ tự trên bảng), mọi nhãn của bảng,
 * thẻ giữ tiêu đề, mô tả, nhãn, màu bìa, checklist (mục chỉ giữ tiêu đề).
 * Bỏ: người được giao, ngày, bình luận / lịch sử, tệp đính kèm, ảnh bìa dạng ảnh.
 */
export async function snapshotBoard(db: Prisma.TransactionClient, boardId: string): Promise<TemplateContent> {
  const board = await db.board.findUniqueOrThrow({
    where: { id: boardId },
    select: {
      labels: { orderBy: { createdAt: 'asc' }, select: { id: true, name: true, color: true } },
      lists: {
        where: notArchived,
        orderBy: byPosition,
        select: {
          title: true,
          cards: {
            where: notArchived,
            orderBy: byPosition,
            select: {
              title: true,
              description: true,
              coverColor: true,
              labels: { select: { labelId: true } },
              checklists: { orderBy: byPosition, select: { title: true, items: { orderBy: byPosition, select: { title: true } } } },
            },
          },
        },
      },
    },
  });
  const labelIndex = new Map(board.labels.map((label, i) => [label.id, i]));
  return {
    labels: board.labels.map(({ name, color }) => ({ name, color })),
    lists: board.lists.map((list) => ({
      title: list.title,
      cards: list.cards.map((card) => {
        const labels = card.labels.map((l) => labelIndex.get(l.labelId)!).sort((a, b) => a - b);
        return {
          title: card.title,
          ...(card.description && { description: card.description }),
          ...(labels.length && { labels }),
          ...(card.coverColor && { coverColor: card.coverColor }),
          ...(card.checklists.length && {
            checklists: card.checklists.map((c) => ({ title: c.title, items: c.items.map((item) => item.title) })),
          }),
        };
      }),
    })),
  };
}

/** Nhãn cho bảng mới tạo từ mẫu: theo mẫu; mẫu không có nhãn nào → 6 nhãn màu mặc định như bảng thường. */
export function boardLabels(content: TemplateContent) {
  const labels = content.labels.length ? content.labels : DEFAULT_LABEL_COLORS.map((color) => ({ name: '', color }));
  // createdAt lệch nhau 1ms để nhãn giữ đúng thứ tự
  return labels.map((label, i) => ({ name: label.name, color: label.color, createdAt: new Date(Date.now() + i) }));
}

/**
 * Tạo danh sách + thẻ (kèm nhãn, checklist chưa hoàn thành) của mẫu vào bảng vừa tạo.
 * `labelIds`: id nhãn của bảng mới, đúng thứ tự `content.labels`.
 */
export async function fillBoard(tx: Prisma.TransactionClient, boardId: string, content: TemplateContent, labelIds: string[]) {
  const position = (i: number) => (i + 1) * POSITION_GAP;
  for (const [i, list] of content.lists.entries()) {
    await tx.list.create({
      data: {
        boardId,
        title: list.title,
        position: position(i),
        cards: {
          create: list.cards.map((card, j) => ({
            title: card.title,
            description: card.description || null,
            position: position(j),
            coverColor: card.coverColor ?? null,
            labels: {
              create: [...new Set(card.labels ?? [])].filter((k) => labelIds[k]).map((k) => ({ labelId: labelIds[k] })),
            },
            checklists: {
              create: (card.checklists ?? []).map((checklist, k) => ({
                title: checklist.title,
                position: position(k),
                items: { create: checklist.items.map((title, m) => ({ title, position: position(m) })) },
              })),
            },
          })),
        },
      },
    });
  }
}
