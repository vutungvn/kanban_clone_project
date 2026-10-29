import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BoardRole, type BoardTemplate, type Prisma } from '@prisma/client';
import { BoardAccessService } from '../boards/board-access.service';
import { toSummary, withMembers } from '../boards/boards.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service';
import { BUILTIN_TEMPLATES, findBuiltinTemplate } from './builtin-templates';
import type { CreateBoardFromTemplateDto, SaveTemplateDto, UpdateTemplateDto } from './dto/template.dto';
import {
  boardLabels,
  countCards,
  fillBoard,
  MAX_TEMPLATE_CARDS,
  MAX_TEMPLATE_LISTS,
  snapshotBoard,
  withoutCards,
  type TemplateContent,
} from './template-content';

export const TEMPLATE_NOT_FOUND = 'Không tìm thấy mẫu';
export const BUILTIN_READONLY = 'Không sửa hoặc xoá được mẫu có sẵn';
export const EMPTY_BOARD = 'Bảng chưa có danh sách nào để lưu thành mẫu';
/** Số mẫu tối đa của mỗi người */
export const MAX_TEMPLATES = 50;
export const TOO_MANY_TEMPLATES = `Bạn đã có ${MAX_TEMPLATES} mẫu — xoá bớt mẫu cũ để lưu mẫu mới`;

/** Thông tin chung để hiện trên trang Mẫu (không kèm nội dung). */
function summarize(
  template: { id: string; title: string; description: string; background: string; content: TemplateContent },
  extra: { builtin: boolean; category: string | null; createdAt: Date | null },
) {
  return {
    id: template.id,
    builtin: extra.builtin,
    title: template.title,
    description: template.description,
    category: extra.category,
    background: template.background,
    lists: template.content.lists.map((l) => l.title),
    cardCount: countCards(template.content),
    createdAt: extra.createdAt,
  };
}

const contentOf = (template: BoardTemplate) => template.content as unknown as TemplateContent;

const summarizeMine = (template: BoardTemplate) =>
  summarize({ ...template, content: contentOf(template) }, { builtin: false, category: null, createdAt: template.createdAt });

/**
 * Mẫu bảng: mẫu có sẵn (trong code, ai cũng thấy) và mẫu của tôi (bản chụp 1 bảng, chỉ người lưu thấy).
 * Tạo bảng từ mẫu: người tạo là ADMIN duy nhất; nhãn theo mẫu; thẻ không có người được giao / ngày,
 * checklist chưa hoàn thành; không ghi lịch sử "đã tạo thẻ".
 */
@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
    private readonly workspaces: WorkspaceAccessService,
  ) {}

  async list(userId: string) {
    const mine = await this.prisma.boardTemplate.findMany({ where: { ownerId: userId }, orderBy: { createdAt: 'desc' } });
    return {
      builtin: BUILTIN_TEMPLATES.map((t) => summarize(t, { builtin: true, category: t.category, createdAt: null })),
      mine: mine.map(summarizeMine),
    };
  }

  /** Mẫu có sẵn hoặc mẫu của chính mình (mẫu của người khác → 404, không lộ là có tồn tại). */
  private async resolve(id: string, userId: string) {
    const builtin = findBuiltinTemplate(id);
    if (builtin) return { summary: summarize(builtin, { builtin: true, category: builtin.category, createdAt: null }), template: builtin };
    const mine = await this.prisma.boardTemplate.findFirst({ where: { id, ownerId: userId } });
    if (!mine) throw new NotFoundException(TEMPLATE_NOT_FOUND);
    return { summary: summarizeMine(mine), template: { ...mine, content: contentOf(mine) } };
  }

  async findOne(id: string, userId: string) {
    const { summary, template } = await this.resolve(id, userId);
    return { ...summary, content: template.content };
  }

  /** Tạo bảng mới từ mẫu — tất cả trong 1 transaction (lỗi giữa chừng không để lại bảng dở dang). */
  async createBoard(id: string, userId: string, dto: CreateBoardFromTemplateDto) {
    const { template } = await this.resolve(id, userId);
    const content = dto.keepCards ? template.content : withoutCards(template.content);
    const workspaceId = await this.workspaces.forNewBoard(userId, dto.workspaceId);
    return this.prisma.$transaction(
      async (tx) => {
        const board = await tx.board.create({
          data: {
            title: dto.title,
            background: dto.background,
            ownerId: userId,
            workspaceId,
            members: { create: { userId, role: BoardRole.ADMIN } },
            labels: { create: boardLabels(content) },
          },
          include: { ...withMembers, labels: { orderBy: { createdAt: 'asc' }, select: { id: true } } },
        });
        await fillBoard(
          tx,
          board.id,
          content,
          board.labels.map((l) => l.id),
        );
        return toSummary(board, board.members[0]);
      },
      // Mẫu nhiều thẻ → nhiều câu lệnh; nới thời gian chờ mặc định (5s)
      { timeout: 30_000 },
    );
  }

  /** Lưu bảng thành mẫu của mình — ai sửa được bảng (ADMIN, MEMBER) thì lưu được. */
  async saveFromBoard(boardId: string, userId: string, dto: SaveTemplateDto) {
    await this.access.require(boardId, userId, BoardRole.MEMBER);
    const owned = await this.prisma.boardTemplate.count({ where: { ownerId: userId } });
    if (owned >= MAX_TEMPLATES) throw new BadRequestException(TOO_MANY_TEMPLATES);

    const board = await this.prisma.board.findUniqueOrThrow({ where: { id: boardId }, select: { background: true } });
    const snapshot = await snapshotBoard(this.prisma, boardId);
    const content = dto.keepCards ? snapshot : withoutCards(snapshot);
    if (!content.lists.length) throw new BadRequestException(EMPTY_BOARD);
    if (content.lists.length > MAX_TEMPLATE_LISTS) {
      throw new BadRequestException(`Mẫu tối đa ${MAX_TEMPLATE_LISTS} danh sách — bảng này có ${content.lists.length} danh sách`);
    }
    const cards = countCards(content);
    if (cards > MAX_TEMPLATE_CARDS) {
      throw new BadRequestException(
        `Mẫu tối đa ${MAX_TEMPLATE_CARDS} thẻ — bảng này có ${cards} thẻ. Bỏ chọn "Gồm cả thẻ" hoặc lưu trữ bớt thẻ`,
      );
    }

    const template = await this.prisma.boardTemplate.create({
      data: {
        ownerId: userId,
        title: dto.title,
        description: dto.description ?? '',
        background: board.background,
        content: content as unknown as Prisma.InputJsonObject,
      },
    });
    return summarizeMine(template);
  }

  /** Chỉ mẫu của mình; mẫu có sẵn → 403. */
  private async requireOwn(id: string, userId: string) {
    if (findBuiltinTemplate(id)) throw new ForbiddenException(BUILTIN_READONLY);
    const template = await this.prisma.boardTemplate.findFirst({ where: { id, ownerId: userId }, select: { id: true } });
    if (!template) throw new NotFoundException(TEMPLATE_NOT_FOUND);
  }

  async update(id: string, userId: string, dto: UpdateTemplateDto) {
    await this.requireOwn(id, userId);
    const template = await this.prisma.boardTemplate.update({
      where: { id },
      data: { title: dto.title, description: dto.description, background: dto.background },
    });
    return summarizeMine(template);
  }

  async remove(id: string, userId: string) {
    await this.requireOwn(id, userId);
    await this.prisma.boardTemplate.delete({ where: { id } });
  }
}
