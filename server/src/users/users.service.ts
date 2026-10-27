import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { avatarUrl, fileNameOf, isImageType, type UploadedFileData } from '../storage/files';
import { StorageService } from '../storage/storage.service';

export const AVATAR_REQUIRED = 'Vui lòng chọn ảnh';
export const AVATAR_NOT_IMAGE = 'Ảnh đại diện phải là JPG, PNG, GIF hoặc WEBP';

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

export function toPublicUser({ id, email, name, avatarUrl, createdAt }: User): PublicUser {
  return { id, email, name, avatarUrl, createdAt };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Trả về cả passwordHash — chỉ dùng nội bộ cho việc xác thực. */
  findByEmailWithPassword(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: publicUserSelect });
  }

  async create(data: { email: string; name: string; passwordHash: string }) {
    try {
      return await this.prisma.user.create({ data, select: publicUserSelect });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Email đã được sử dụng');
      }
      throw e;
    }
  }

  async updateName(userId: string, name: string) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { name }, select: publicUserSelect });
    await this.profileChanged(userId);
    return user;
  }

  /** Đổi ảnh đại diện: tải ảnh mới lên rồi xoá ảnh cũ. */
  async setAvatar(userId: string, file: UploadedFileData | undefined) {
    if (!file?.size) throw new BadRequestException(AVATAR_REQUIRED);
    if (!isImageType(file.mimetype)) throw new BadRequestException(AVATAR_NOT_IMAGE);
    const stored = await this.storage.upload({ buffer: file.buffer, mimeType: file.mimetype, name: fileNameOf(file) }, 'avatars');
    return this.replaceAvatar(userId, { avatarUrl: avatarUrl(stored.url), avatarKey: stored.storageKey });
  }

  removeAvatar(userId: string) {
    return this.replaceAvatar(userId, { avatarUrl: null, avatarKey: null });
  }

  private async replaceAvatar(userId: string, data: { avatarUrl: string | null; avatarKey: string | null }) {
    const previous = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarKey: true } });
    const user = await this.prisma.user.update({ where: { id: userId }, data, select: publicUserSelect });
    if (previous?.avatarKey && previous.avatarKey !== data.avatarKey) void this.storage.discard([previous.avatarKey]);
    await this.profileChanged(userId);
    return user;
  }

  /**
   * Tên / ảnh đại diện đổi: các tab khác của chính mình tải lại thông tin tài khoản;
   * người đang mở các bảng mình tham gia tải lại bảng (danh sách thành viên).
   */
  private async profileChanged(userId: string) {
    this.realtime.toUser(userId, 'account:updated', {}, true);
    const memberships = await this.prisma.boardMember.findMany({ where: { userId }, select: { boardId: true } });
    for (const { boardId } of memberships) this.realtime.boardChanged(boardId);
  }
}
