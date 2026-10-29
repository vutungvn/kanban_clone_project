import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType, Prisma } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { dueReminderMessage, type DueReminderItem } from '../mail/templates';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const HOUR_MS = 60 * 60 * 1000;
/** Còn ít hơn chừng này tới hạn chót thì nhắc "sắp hết hạn" */
export const DUE_SOON_MS = 24 * HOUR_MS;
/** Quá hạn lâu hơn chừng này thì thôi không nhắc (server ngủ lỡ lượt quét, thẻ cũ lúc mới bật tính năng) */
export const OVERDUE_LOOKBACK_MS = 24 * HOUR_MS;
/** Số thẻ tối đa mỗi mốc trong 1 lượt — còn lại để lượt sau */
const BATCH_SIZE = 500;

type ReminderKind = 'soon' | 'overdue';

/** Mỗi mốc: loại thông báo + cột đánh dấu đã gửi trên thẻ. */
const KINDS = {
  soon: {
    type: NotificationType.CARD_DUE_SOON,
    unsent: { dueSoonNotifiedAt: null },
    sent: (at: Date) => ({ dueSoonNotifiedAt: at }),
  },
  overdue: {
    type: NotificationType.CARD_OVERDUE,
    unsent: { overdueNotifiedAt: null },
    sent: (at: Date) => ({ overdueNotifiedAt: at }),
  },
} satisfies Record<
  ReminderKind,
  { type: NotificationType; unsent: Prisma.CardWhereInput; sent: (at: Date) => Prisma.CardUpdateManyMutationInput }
>;

const reminderCardSelect = {
  id: true,
  title: true,
  dueDate: true,
  members: {
    select: { user: { select: { id: true, name: true, email: true, emailVerifiedAt: true, emailDueReminders: true } } },
  },
  list: { select: { board: { select: { id: true, title: true } } } },
} satisfies Prisma.CardSelect;

type ReminderCard = Prisma.CardGetPayload<{ select: typeof reminderCardSelect }>;
type Recipient = ReminderCard['members'][number]['user'];

export interface DueRemindersResult {
  /** Số thẻ vừa nhắc "sắp hết hạn" */
  dueSoon: number;
  /** Số thẻ vừa nhắc "quá hạn" */
  overdue: number;
  /** Số email đã gửi (mỗi người tối đa 1 email / lượt) */
  emails: number;
}

/**
 * Nhắc hạn chót cho người được giao thẻ: còn dưới 24 giờ ("sắp hết hạn") và vừa quá hạn ("quá hạn").
 * Mỗi mốc gửi 1 lần cho mỗi giá trị hạn chót (đổi hạn chót → CardsService đặt lại cột đánh dấu).
 * Gửi thông báo trong app + 1 email gộp mọi thẻ của người đó trong lượt.
 *
 * Kích hoạt bởi interval trong process VÀ endpoint nội bộ (GitHub Actions gọi theo lịch — Render free cho server
 * ngủ nên interval không tự chạy được). Chạy trùng vẫn an toàn: mỗi thẻ được "giữ chỗ" bằng update có điều kiện.
 */
@Injectable()
export class DueRemindersService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(DueRemindersService.name);
  private readonly clientUrl: string;
  private readonly intervalMinutes: number;
  private readonly dueFormat: Intl.DateTimeFormat;
  private timer?: NodeJS.Timeout;
  private running: Promise<DueRemindersResult> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.clientUrl = config.get('CLIENT_URL', 'http://localhost:3000').replace(/\/$/, '');
    this.intervalMinutes = Number(config.get('DUE_REMINDER_INTERVAL_MINUTES', 15));
    this.dueFormat = createDueFormat(config.get('APP_TIMEZONE', 'Asia/Ho_Chi_Minh'), this.logger);
  }

  onApplicationBootstrap() {
    if (!(this.intervalMinutes > 0)) {
      this.logger.log('Không quét nhắc hạn chót trong process (DUE_REMINDER_INTERVAL_MINUTES = 0) — chỉ chạy qua endpoint');
      return;
    }
    const tick = () => void this.run().catch((e) => this.logger.error(`Quét nhắc hạn chót lỗi: ${String(e)}`));
    // Chạy ngay khi khởi động: server vừa được đánh thức có thể đã lỡ vài lượt
    tick();
    this.timer = setInterval(tick, this.intervalMinutes * 60_000);
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  /** Quét 1 lượt. Đang có lượt chạy trong process này (interval + endpoint cùng lúc) thì dùng chung kết quả. */
  run() {
    this.running ??= this.scan().finally(() => (this.running = null));
    return this.running;
  }

  private async scan(): Promise<DueRemindersResult> {
    const now = new Date();
    // Chưa hoàn thành, thẻ và danh sách chứa nó chưa lưu trữ, có người được giao
    const pending = { dueComplete: false, archivedAt: null, list: { archivedAt: null }, members: { some: {} } } satisfies Prisma.CardWhereInput;
    const [overdue, soon] = await Promise.all([
      this.prisma.card.findMany({
        where: { ...pending, ...KINDS.overdue.unsent, dueDate: { lte: now, gt: new Date(now.getTime() - OVERDUE_LOOKBACK_MS) } },
        select: reminderCardSelect,
        orderBy: { dueDate: 'asc' },
        take: BATCH_SIZE,
      }),
      this.prisma.card.findMany({
        // Đã nhắc quá hạn (hạn chót bị lùi lại sau đó thì cột đã về null) → không nhắc sắp hết hạn nữa
        where: { ...pending, ...KINDS.soon.unsent, ...KINDS.overdue.unsent, dueDate: { gt: now, lte: new Date(now.getTime() + DUE_SOON_MS) } },
        select: reminderCardSelect,
        orderBy: { dueDate: 'asc' },
        take: BATCH_SIZE,
      }),
    ]);

    const result: DueRemindersResult = { dueSoon: 0, overdue: 0, emails: 0 };
    const emails = new Map<string, { user: Recipient; items: DueReminderItem[] }>();
    for (const [kind, cards] of [['overdue', overdue], ['soon', soon]] as const) {
      for (const card of cards) {
        if (!(await this.claim(card, kind, now))) continue;
        result[kind === 'soon' ? 'dueSoon' : 'overdue']++;
        const { board } = card.list;
        const dueDate = card.dueDate!;
        await this.notifications.notifySystem(
          card.members.map(({ user }) => ({
            userId: user.id,
            type: KINDS[kind].type,
            boardId: board.id,
            cardId: card.id,
            data: { boardTitle: board.title, cardTitle: card.title, dueDate: dueDate.toISOString() },
          })),
        );
        for (const { user } of card.members) {
          if (!this.wantsEmail(user)) continue;
          const entry = emails.get(user.id) ?? { user, items: [] };
          entry.items.push({
            kind,
            cardTitle: card.title,
            boardTitle: board.title,
            due: this.formatDue(dueDate),
            url: `${this.clientUrl}/b/${board.id}?card=${encodeURIComponent(card.id)}`,
          });
          emails.set(user.id, entry);
        }
      }
    }

    // Lỗi gửi mail chỉ ghi log, không thử lại — thông báo trong app đã lưu
    for (const { user, items } of emails.values()) {
      try {
        await this.mail.send(
          dueReminderMessage({
            to: user.email,
            name: user.name,
            items,
            homeUrl: `${this.clientUrl}/home`,
            settingsUrl: `${this.clientUrl}/account?tab=notifications`,
          }),
        );
        result.emails++;
      } catch (e) {
        this.logger.warn(`Không gửi được email nhắc hạn chót tới ${user.email}: ${String(e)}`);
      }
    }

    if (result.dueSoon || result.overdue) {
      this.logger.log(`Nhắc hạn chót: ${result.dueSoon} thẻ sắp hết hạn, ${result.overdue} thẻ quá hạn, ${result.emails} email`);
    }
    return result;
  }

  /**
   * Giữ chỗ mốc nhắc của thẻ: chỉ 1 lượt quét (kể cả chạy song song) cập nhật được → chỉ lượt đó gửi.
   * Hạn chót vừa bị đổi / vừa đánh dấu hoàn thành giữa lúc đọc và lúc giữ chỗ → bỏ qua.
   */
  private async claim(card: ReminderCard, kind: ReminderKind, now: Date) {
    const { count } = await this.prisma.card.updateMany({
      where: { id: card.id, dueDate: card.dueDate, dueComplete: false, ...KINDS[kind].unsent },
      data: KINDS[kind].sent(now),
    });
    return count === 1;
  }

  /** Bật email nhắc hạn và đã xác minh email (app chưa cấu hình gửi mail thì không bắt xác minh — mail chỉ in ra log). */
  private wantsEmail(user: Recipient) {
    return user.emailDueReminders && (!!user.emailVerifiedAt || !this.mail.enabled);
  }

  /** "10:00 ngày 31/10/2026" theo múi giờ của app */
  private formatDue(date: Date) {
    const part = Object.fromEntries(this.dueFormat.formatToParts(date).map((p) => [p.type, p.value]));
    return `${part.hour}:${part.minute} ngày ${part.day}/${part.month}/${part.year}`;
  }
}

function createDueFormat(timeZone: string, logger: Logger) {
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  };
  try {
    return new Intl.DateTimeFormat('en-GB', { ...options, timeZone });
  } catch {
    logger.warn(`APP_TIMEZONE "${timeZone}" không hợp lệ — dùng Asia/Ho_Chi_Minh`);
    return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'Asia/Ho_Chi_Minh' });
  }
}
