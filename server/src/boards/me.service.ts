import { Injectable } from '@nestjs/common';
import { ActivityType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ListMyActivitiesQueryDto } from './dto/me.dto';

/** Trang chủ hiện tối đa ngần này thẻ được giao (giao gần đây trước) */
const MAX_MY_CARDS = 500;

const myCardSelect = (userId: string) =>
  ({
    createdAt: true,
    card: {
      select: {
        id: true,
        title: true,
        startDate: true,
        dueDate: true,
        dueComplete: true,
        list: {
          select: {
            id: true,
            title: true,
            board: { select: { id: true, title: true, background: true, members: { where: { userId }, select: { role: true } } } },
          },
        },
        labels: { select: { label: { select: { id: true, name: true, color: true, createdAt: true } } } },
        checklists: { select: { items: { select: { completed: true } } } },
        _count: { select: { attachments: true, activities: { where: { type: ActivityType.COMMENT } } } },
      },
    },
  }) satisfies Prisma.CardMemberSelect;

const feedInclude = {
  user: { select: { id: true, name: true, avatarUrl: true } },
  card: { select: { id: true, title: true } },
  board: { select: { id: true, title: true, background: true } },
} as const satisfies Prisma.ActivityInclude;

/**
 * Dữ liệu "của tôi" gom từ mọi bảng: thẻ được giao (Trang chủ) và dòng hoạt động (trang Hoạt động).
 * Chỉ đọc; chỉ thấy dữ liệu của các bảng mình đang là thành viên.
 */
@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Thẻ đang giao cho mình — bỏ thẻ / danh sách đã lưu trữ và bảng mình không còn ở trong. */
  async cards(userId: string) {
    const links = await this.prisma.cardMember.findMany({
      where: {
        userId,
        card: { archivedAt: null, list: { archivedAt: null, board: { members: { some: { userId } } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_MY_CARDS,
      select: myCardSelect(userId),
    });
    return links.map(({ createdAt, card: { list, labels, checklists, _count, ...card } }) => {
      const items = checklists.flatMap((c) => c.items);
      const { members, ...board } = list.board;
      return {
        ...card,
        assignedAt: createdAt,
        list: { id: list.id, title: list.title },
        board: { ...board, role: members[0].role },
        labels: labels
          .map((l) => l.label)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map(({ createdAt: _createdAt, ...label }) => label),
        checklist: { done: items.filter((i) => i.completed).length, total: items.length },
        commentCount: _count.activities,
        attachmentCount: _count.attachments,
      };
    });
  }

  /** Hoạt động trên các bảng mình đang là thành viên, mới nhất trước, phân trang theo cursor (id). */
  async activities(userId: string, query: ListMyActivitiesQueryDto) {
    const memberships = await this.prisma.boardMember.findMany({ where: { userId }, select: { boardId: true } });
    let boardIds = memberships.map((m) => m.boardId);
    if (query.boardId) boardIds = boardIds.includes(query.boardId) ? [query.boardId] : [];
    if (!boardIds.length) return { activities: [], nextCursor: null };

    const rows = await this.prisma.activity.findMany({
      where: { boardId: { in: boardIds }, ...(query.scope === 'mine' && { userId }) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      include: feedInclude,
    });
    const page = rows.slice(0, query.limit);
    return {
      activities: page.map(({ boardId: _boardId, userId: _userId, ...activity }) => activity),
      nextCursor: rows.length > query.limit ? page[page.length - 1].id : null,
    };
  }
}
