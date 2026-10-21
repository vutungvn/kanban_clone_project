import { Injectable, NotFoundException } from '@nestjs/common';
import { BoardRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { BoardAccessService } from './board-access.service';
import { LABEL_NOT_FOUND } from './cards.service';
import type { CreateLabelDto, UpdateLabelDto } from './dto/label.dto';

/** Nhãn của bảng. Thêm / sửa / xoá cần vai trò MEMBER trở lên. */
@Injectable()
export class LabelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
    private readonly realtime: RealtimeService,
  ) {}

  async create(boardId: string, userId: string, dto: CreateLabelDto) {
    await this.access.require(boardId, userId, BoardRole.MEMBER);
    const label = await this.prisma.label.create({ data: { boardId, name: dto.name ?? '', color: dto.color } });
    this.realtime.boardChanged(boardId);
    return label;
  }

  async update(labelId: string, userId: string, dto: UpdateLabelDto) {
    const boardId = await this.requireEditable(labelId, userId);
    const label = await this.prisma.label.update({
      where: { id: labelId },
      data: { name: dto.name ?? undefined, color: dto.color },
    });
    this.realtime.boardChanged(boardId);
    return label;
  }

  /** Xoá nhãn — tự gỡ khỏi mọi thẻ (onDelete: Cascade). */
  async remove(labelId: string, userId: string) {
    const boardId = await this.requireEditable(labelId, userId);
    await this.prisma.label.delete({ where: { id: labelId } });
    this.realtime.boardChanged(boardId);
  }

  private async requireEditable(labelId: string, userId: string) {
    const label = await this.prisma.label.findUnique({ where: { id: labelId }, select: { boardId: true } });
    if (!label) throw new NotFoundException(LABEL_NOT_FOUND);
    await this.access.require(label.boardId, userId, BoardRole.MEMBER, LABEL_NOT_FOUND);
    return label.boardId;
  }
}
