import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Gửi email qua SMTP (nodemailer).
 * - Có SMTP_HOST → gửi thật (Gmail, Brevo... — xem .env.example).
 * - Không có → chỉ in nội dung ra log, và app không bắt xác minh email (xem `enabled`).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const user = config.get<string>('SMTP_USER');
    this.transporter = host
      ? createTransport({
          host,
          port: Number(config.get('SMTP_PORT', 587)),
          // 465 = SSL ngay từ đầu (SMTP_SECURE=true); 587 = STARTTLS
          secure: config.get('SMTP_SECURE', 'false') === 'true',
          auth: user ? { user, pass: config.get<string>('SMTP_PASS') } : undefined,
          connectionTimeout: 10_000,
        })
      : null;
    // Gmail chỉ cho gửi bằng chính địa chỉ đăng nhập → mặc định lấy SMTP_USER
    this.from = config.get<string>('MAIL_FROM') || `Kanban <${user ?? 'no-reply@kanban.local'}>`;
  }

  /** Đã cấu hình SMTP — gửi được email thật. */
  get enabled() {
    return !!this.transporter;
  }

  /** Lỗi gửi (sai cấu hình, SMTP sập...) được ném ra cho nơi gọi quyết định. */
  async send(message: MailMessage) {
    if (!this.transporter) {
      this.logger.log(`[chưa cấu hình SMTP] Email tới ${message.to} — ${message.subject}\n${message.text}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, ...message });
  }
}
