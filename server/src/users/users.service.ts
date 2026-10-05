import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

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
}
