import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/** "Kanban <ban@gmail.com>" → { name: "Kanban", email: "ban@gmail.com" } */
function parseAddress(value: string) {
  const match = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return match ? { name: match[1] || undefined, email: match[2].trim() } : { email: value.trim() };
}

/**
 * Gửi email. Chọn cách gửi theo biến môi trường:
 * - BREVO_API_KEY → HTTP API của Brevo (cổng 443). Dùng trên Render: gói free chặn kết nối SMTP ra ngoài.
 * - SMTP_HOST → SMTP qua nodemailer (dev: Gmail...).
 * - Không có cả hai → chỉ in nội dung ra log, và app không bắt xác minh email (xem `enabled`).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly brevoApiKey: string | undefined;
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.brevoApiKey = config.get<string>('BREVO_API_KEY') || undefined;
    const host = config.get<string>('SMTP_HOST');
    const user = config.get<string>('SMTP_USER');
    this.transporter =
      !this.brevoApiKey && host
        ? createTransport({
            host,
            port: Number(config.get('SMTP_PORT', 587)),
            // 465 = SSL ngay từ đầu (SMTP_SECURE=true); 587 = STARTTLS
            secure: config.get('SMTP_SECURE', 'false') === 'true',
            auth: user ? { user, pass: config.get<string>('SMTP_PASS') } : undefined,
            connectionTimeout: 10_000,
          })
        : null;
    // Gmail chỉ cho gửi bằng chính địa chỉ đăng nhập → mặc định lấy SMTP_USER.
    // Brevo: MAIL_FROM phải là người gửi đã xác minh trong Brevo (Senders).
    this.from = config.get<string>('MAIL_FROM') || `Kanban <${user ?? 'no-reply@kanban.local'}>`;
    if (this.brevoApiKey && !config.get<string>('MAIL_FROM')) {
      this.logger.warn('Đang gửi qua Brevo nhưng chưa đặt MAIL_FROM (phải là người gửi đã xác minh trong Brevo)');
    }
  }

  /** Gửi được email thật (Brevo hoặc SMTP). */
  get enabled() {
    return !!this.brevoApiKey || !!this.transporter;
  }

  /** Lỗi gửi (sai cấu hình, dịch vụ mail lỗi...) được ném ra cho nơi gọi quyết định. */
  async send(message: MailMessage) {
    if (this.brevoApiKey) return this.sendWithBrevo(message);
    if (!this.transporter) {
      this.logger.log(`[chưa cấu hình gửi mail] Email tới ${message.to} — ${message.subject}\n${message.text}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, ...message });
  }

  private async sendWithBrevo(message: MailMessage) {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: { 'api-key': this.brevoApiKey!, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: parseAddress(this.from),
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // Brevo trả { code, message } — vd "Sender ... is not valid" khi MAIL_FROM chưa được xác minh
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(`Brevo ${res.status}: ${body?.message ?? res.statusText}`);
    }
  }
}
