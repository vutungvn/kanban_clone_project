import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailTokenType } from '@prisma/client';
import { hash } from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { MailService } from '../mail/mail.service';
import { resetPasswordMessage, verifyEmailMessage } from '../mail/templates';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

export const INVALID_VERIFY_LINK = 'Liên kết xác minh không hợp lệ hoặc đã hết hạn';
export const INVALID_RESET_LINK = 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn';

const HOUR_MS = 60 * 60 * 1000;
const TTL_MS: Record<EmailTokenType, number> = { VERIFY_EMAIL: 24 * HOUR_MS, RESET_PASSWORD: HOUR_MS };
/** Không gửi lại cùng loại email cho 1 người trong khoảng này (chống spam hộp thư) */
const RESEND_COOLDOWN_MS = 60_000;
const BCRYPT_ROUNDS = 10;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

type Recipient = { id: string; email: string; name: string };

/**
 * Các luồng qua email: xác minh email khi đăng ký, quên / đặt lại mật khẩu.
 * Token chỉ lưu dạng hash, dùng 1 lần, có hạn. Gửi lại / quên mật khẩu luôn trả cùng 1 kết quả
 * (không lộ email nào đã đăng ký); mail gửi nền để thời gian phản hồi như nhau.
 */
@Injectable()
export class EmailFlowsService {
  private readonly logger = new Logger(EmailFlowsService.name);
  private readonly clientUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.clientUrl = config.get('CLIENT_URL', 'http://localhost:3000').replace(/\/$/, '');
  }

  /** Có SMTP thì bắt xác minh email; không (dev chưa cấu hình) thì tài khoản mới được xác minh luôn. */
  get verificationRequired() {
    return this.mail.enabled;
  }

  /** Sau khi đăng ký. Trả về true nếu cần xác minh trước khi đăng nhập. */
  async afterRegister(user: Recipient, next?: string) {
    if (!this.verificationRequired) {
      await this.prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
      return false;
    }
    this.background(this.sendVerification(user, next));
    return true;
  }

  async resendVerification(email: string, next?: string) {
    if (!this.verificationRequired) return;
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, emailVerifiedAt: true },
    });
    if (!user || user.emailVerifiedAt || (await this.inCooldown(user.id, EmailTokenType.VERIFY_EMAIL))) return;
    this.background(this.sendVerification(user, next));
  }

  /**
   * Bấm link xác minh. Link đã dùng mà tài khoản đã xác minh → vẫn thành công
   * (mở lại link, hoặc React gọi 2 lần khi dev).
   */
  async verifyEmail(token: string) {
    const row = await this.findToken(token, EmailTokenType.VERIFY_EMAIL);
    if (!row) throw new BadRequestException(INVALID_VERIFY_LINK);
    if (row.usedAt) {
      if (row.user.emailVerifiedAt) return { email: row.user.email };
      throw new BadRequestException(INVALID_VERIFY_LINK);
    }
    if (row.expiresAt < new Date()) throw new BadRequestException(INVALID_VERIFY_LINK);
    await this.prisma.$transaction([
      this.prisma.emailToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: row.user.emailVerifiedAt ?? new Date() } }),
    ]);
    return { email: row.user.email };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } });
    if (!user || (await this.inCooldown(user.id, EmailTokenType.RESET_PASSWORD))) return;
    this.background(
      (async () => {
        const token = await this.issueToken(user.id, EmailTokenType.RESET_PASSWORD);
        await this.mail.send(resetPasswordMessage(user.email, user.name, this.link('/reset-password', { token })));
      })(),
    );
  }

  /** Mở trang đặt lại mật khẩu: link còn dùng được không (chưa dùng, chưa hết hạn, chưa bị link mới thay thế). */
  async checkResetToken(token: string) {
    const row = await this.findToken(token, EmailTokenType.RESET_PASSWORD);
    if (!row || row.usedAt || row.expiresAt < new Date()) throw new BadRequestException(INVALID_RESET_LINK);
  }

  /**
   * Đặt mật khẩu mới bằng link trong email: link chỉ dùng 1 lần, mọi link đặt lại khác của người đó hết hiệu lực,
   * mọi thiết bị bị đăng xuất. Mở được email cũng chứng minh sở hữu email → xác minh luôn.
   */
  async resetPassword(token: string, password: string) {
    const row = await this.findToken(token, EmailTokenType.RESET_PASSWORD);
    if (!row || row.usedAt || row.expiresAt < new Date()) throw new BadRequestException(INVALID_RESET_LINK);
    const passwordHash = await hash(password, BCRYPT_ROUNDS);
    const used = await this.prisma.$transaction(async (tx) => {
      // Đánh dấu đã dùng có điều kiện: 2 request cùng lúc thì chỉ 1 cái thành công
      const { count } = await tx.emailToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
      if (!count) return false;
      await tx.emailToken.updateMany({
        where: { userId: row.userId, type: EmailTokenType.RESET_PASSWORD, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.user.update({
        where: { id: row.userId },
        data: { passwordHash, emailVerifiedAt: row.user.emailVerifiedAt ?? new Date() },
      });
      return true;
    });
    if (!used) throw new BadRequestException(INVALID_RESET_LINK);
    await this.auth.revokeAllSessions(row.userId);
  }

  private async sendVerification(user: Recipient, next?: string) {
    const token = await this.issueToken(user.id, EmailTokenType.VERIFY_EMAIL);
    const url = this.link('/verify-email', { token, ...(next && { next }) });
    await this.mail.send(verifyEmailMessage(user.email, user.name, url));
  }

  /**
   * Tạo link mới và huỷ mọi link cùng loại chưa dùng của người đó: bấm "Gửi lại" thì chỉ link trong email mới nhất
   * còn hiệu lực. Xoá hẳn (không đánh dấu đã dùng) để link cũ báo "không hợp lệ" chứ không báo "đã xác minh".
   */
  private async issueToken(userId: string, type: EmailTokenType) {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.emailToken.deleteMany({ where: { userId, type, usedAt: null } }),
      this.prisma.emailToken.create({
        data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + TTL_MS[type]) },
      }),
    ]);
    return token;
  }

  private findToken(token: string, type: EmailTokenType) {
    return this.prisma.emailToken.findFirst({
      where: { tokenHash: sha256(token), type },
      include: { user: { select: { email: true, emailVerifiedAt: true } } },
    });
  }

  private async inCooldown(userId: string, type: EmailTokenType) {
    const last = await this.prisma.emailToken.findFirst({
      where: { userId, type },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return !!last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS;
  }

  private link(path: string, params: Record<string, string>) {
    return `${this.clientUrl}${path}?${new URLSearchParams(params)}`;
  }

  /** Gửi mail không chặn response; lỗi SMTP chỉ ghi log (người dùng bấm "Gửi lại" được). */
  private background(task: Promise<unknown>) {
    task.catch((e: unknown) => this.logger.error(`Gửi email thất bại: ${e instanceof Error ? e.message : String(e)}`));
  }
}
