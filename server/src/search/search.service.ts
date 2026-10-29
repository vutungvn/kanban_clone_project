import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SearchQueryDto } from './dto/search.dto';
import { excerptAround, searchTerms, toTsQuery } from './search-text';

interface BoardColumns {
  boardId: string;
  boardTitle: string;
  boardBackground: string;
}

interface CardRow extends BoardColumns {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  dueComplete: boolean;
  archived: boolean;
  inTitle: boolean;
  listId: string;
  listTitle: string;
}

interface CommentRow extends BoardColumns {
  id: string;
  text: string;
  createdAt: Date;
  authorId: string | null;
  authorName: string | null;
  authorAvatarUrl: string | null;
  cardId: string;
  cardTitle: string;
  archived: boolean;
}

const toBoard = (row: BoardColumns) => ({ id: row.boardId, title: row.boardTitle, background: row.boardBackground });

/**
 * Tìm kiếm toàn cục bằng full-text search của Postgres (cột generated `searchVector`, xem migration global_search):
 * thẻ (tiêu đề + mô tả) và bình luận trên mọi bảng mình đang là thành viên.
 * Quyền kiểm tra ngay trong câu truy vấn (JOIN board_members) → rời bảng là hết thấy kết quả của bảng đó.
 * Từ khoá đi vào SQL dưới dạng tham số; ký tự đặc biệt đã bị bỏ ở searchTerms nên to_tsquery không bao giờ lỗi cú pháp.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(userId: string, query: SearchQueryDto) {
    const terms = searchTerms(query.q);
    const wantCards = query.type !== 'comments';
    const wantComments = query.type !== 'cards';
    const empty = { items: [], total: 0 };
    if (!terms.length) {
      return { ...(wantCards && { cards: empty }), ...(wantComments && { comments: empty }) };
    }

    // f_unaccent cả ở đây (dù terms đã bỏ dấu) để truy vấn bỏ dấu đúng y như lúc tạo vector
    const tsQueries = Prisma.sql`WITH q AS (
      SELECT to_tsquery('simple', f_unaccent(${toTsQuery(terms)})) AS query,
             to_tsquery('simple', f_unaccent(${toTsQuery(terms, 'A')})) AS title_query
    )`;
    const access = Prisma.sql`
      JOIN lists l ON l.id = c."listId"
      JOIN boards b ON b.id = l."boardId"
      JOIN board_members m ON m."boardId" = b.id AND m."userId" = ${userId}`;
    const filters = Prisma.sql`
      ${query.boardId ? Prisma.sql`AND b.id = ${query.boardId}` : Prisma.empty}
      ${query.archived ? Prisma.empty : Prisma.sql`AND c."archivedAt" IS NULL AND l."archivedAt" IS NULL`}`;
    const page = Prisma.sql`LIMIT ${query.limit} OFFSET ${query.offset}`;

    const [cards, comments] = await Promise.all([
      wantCards ? this.cards(terms, tsQueries, access, filters, page) : undefined,
      wantComments ? this.comments(terms, tsQueries, access, filters, page) : undefined,
    ]);
    return { ...(cards && { cards }), ...(comments && { comments }) };
  }

  /** Mọi từ khoá trong tiêu đề → xếp trên; rồi theo ts_rank (tiêu đề nặng hơn mô tả); rồi thẻ mới cập nhật. */
  private async cards(terms: string[], tsQueries: Prisma.Sql, access: Prisma.Sql, filters: Prisma.Sql, page: Prisma.Sql) {
    const [rows, [{ total }]] = await Promise.all([
      this.prisma.$queryRaw<CardRow[]>`${tsQueries}
        SELECT c.id, c.title, c.description, c."dueDate", c."dueComplete",
               (c."archivedAt" IS NOT NULL OR l."archivedAt" IS NOT NULL) AS archived,
               c."searchVector" @@ q.title_query AS "inTitle",
               l.id AS "listId", l.title AS "listTitle",
               b.id AS "boardId", b.title AS "boardTitle", b.background AS "boardBackground"
        FROM q, cards c ${access}
        WHERE c."searchVector" @@ q.query ${filters}
        ORDER BY "inTitle" DESC, ts_rank(c."searchVector", q.query) DESC, c."updatedAt" DESC, c.id
        ${page}`,
      this.prisma.$queryRaw<[{ total: number }]>`${tsQueries}
        SELECT count(*)::int AS total FROM q, cards c ${access}
        WHERE c."searchVector" @@ q.query ${filters}`,
    ]);
    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        matchedIn: row.inTitle ? ('title' as const) : ('description' as const),
        excerpt: !row.inTitle && row.description ? excerptAround(row.description, terms) : null,
        dueDate: row.dueDate,
        dueComplete: row.dueComplete,
        archived: row.archived,
        list: { id: row.listId, title: row.listTitle },
        board: toBoard(row),
      })),
    };
  }

  /** Theo ts_rank, rồi bình luận mới hơn. Thẻ đã lưu trữ → bình luận của nó cũng theo bộ lọc `archived`. */
  private async comments(terms: string[], tsQueries: Prisma.Sql, access: Prisma.Sql, filters: Prisma.Sql, page: Prisma.Sql) {
    const [rows, [{ total }]] = await Promise.all([
      this.prisma.$queryRaw<CommentRow[]>`${tsQueries}
        SELECT a.id, a.text, a."createdAt",
               u.id AS "authorId", u.name AS "authorName", u."avatarUrl" AS "authorAvatarUrl",
               c.id AS "cardId", c.title AS "cardTitle",
               (c."archivedAt" IS NOT NULL OR l."archivedAt" IS NOT NULL) AS archived,
               b.id AS "boardId", b.title AS "boardTitle", b.background AS "boardBackground"
        FROM q, activities a
        JOIN cards c ON c.id = a."cardId" ${access}
        LEFT JOIN users u ON u.id = a."userId"
        WHERE a.type = 'COMMENT' AND a."searchVector" @@ q.query ${filters}
        ORDER BY ts_rank(a."searchVector", q.query) DESC, a."createdAt" DESC, a.id
        ${page}`,
      this.prisma.$queryRaw<[{ total: number }]>`${tsQueries}
        SELECT count(*)::int AS total FROM q, activities a
        JOIN cards c ON c.id = a."cardId" ${access}
        WHERE a.type = 'COMMENT' AND a."searchVector" @@ q.query ${filters}`,
    ]);
    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        excerpt: excerptAround(row.text, terms),
        createdAt: row.createdAt,
        author: row.authorId ? { id: row.authorId, name: row.authorName!, avatarUrl: row.authorAvatarUrl } : null,
        card: { id: row.cardId, title: row.cardTitle, archived: row.archived },
        board: toBoard(row),
      })),
    };
  }
}
