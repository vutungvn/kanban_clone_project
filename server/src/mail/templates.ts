import type { MailMessage } from './mail.service';

const HTML_ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch]);

/** HTML đơn giản → text thuần: link thành "chữ (url)", <br> xuống dòng, bỏ thẻ, giải mã ký tự đã escape. */
const toText = (html: string) =>
  html
    .replace(/<a href="([^"]*)"[^>]*>(.*?)<\/a>/g, '$2 ($1)')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39);/g, (entity) => Object.keys(HTML_ENTITIES).find((ch) => HTML_ENTITIES[ch] === entity)!);

/**
 * Khung email chung: tiêu đề, các đoạn văn, 1 nút bấm + link dự phòng, ghi chú cuối.
 * Style viết inline (nhiều trình đọc mail bỏ thẻ <style>).
 */
function layout(input: { to: string; subject: string; heading: string; paragraphs: string[]; button: string; url: string; note: string }): MailMessage {
  const paragraphs = input.paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#172b4d">${p}</p>`)
    .join('');
  const html = `<!doctype html>
<html lang="vi"><body style="margin:0;padding:24px 12px;background:#f1f3ff;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
    <tr><td style="background:#0c66e4;padding:18px 28px;color:#ffffff;font-size:18px;font-weight:700">Kanban</td></tr>
    <tr><td style="padding:28px">
      <h1 style="margin:0 0 16px;font-size:20px;color:#041b3c">${input.heading}</h1>
      ${paragraphs}
      <p style="margin:24px 0">
        <a href="${escapeHtml(input.url)}" style="display:inline-block;background:#0c66e4;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:6px">${input.button}</a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#424654">Nút không bấm được? Mở liên kết sau trong trình duyệt:</p>
      <p style="margin:0 0 24px;font-size:13px;word-break:break-all"><a href="${escapeHtml(input.url)}" style="color:#0c66e4">${escapeHtml(input.url)}</a></p>
      <p style="margin:0;padding-top:16px;border-top:1px solid #e0e8ff;font-size:12px;color:#727786">${input.note}</p>
    </td></tr>
  </table>
</body></html>`;
  const text = [
    toText(input.heading),
    '',
    ...input.paragraphs.flatMap((p) => [toText(p), '']),
    `${input.button}: ${input.url}`,
    '',
    toText(input.note),
  ].join('\n');
  return { to: input.to, subject: input.subject, html, text };
}

export function verifyEmailMessage(to: string, name: string, url: string) {
  return layout({
    to,
    subject: 'Xác minh email cho tài khoản Kanban',
    heading: `Chào ${escapeHtml(name)},`,
    paragraphs: ['Cảm ơn bạn đã đăng ký Kanban. Bấm nút bên dưới để xác minh địa chỉ email và bắt đầu sử dụng.'],
    button: 'Xác minh email',
    url,
    note: 'Liên kết có hiệu lực trong 24 giờ. Nếu bạn không đăng ký tài khoản này, hãy bỏ qua email.',
  });
}

export function resetPasswordMessage(to: string, name: string, url: string) {
  return layout({
    to,
    subject: 'Đặt lại mật khẩu Kanban',
    heading: `Chào ${escapeHtml(name)},`,
    paragraphs: [
      'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.',
      'Đặt mật khẩu mới xong, mọi thiết bị đang đăng nhập sẽ bị đăng xuất.',
    ],
    button: 'Đặt lại mật khẩu',
    url,
    note: 'Liên kết có hiệu lực trong 1 giờ và chỉ dùng được 1 lần. Nếu bạn không yêu cầu, hãy bỏ qua email — mật khẩu vẫn giữ nguyên.',
  });
}

export interface DueReminderItem {
  kind: 'soon' | 'overdue';
  cardTitle: string;
  boardTitle: string;
  /** Hạn chót đã định dạng theo múi giờ của app, vd "31/10/2026 10:00" */
  due: string;
  /** Link mở thẻ */
  url: string;
}

const SUBJECT_TITLE_LENGTH = 60;

/** Nhắc hạn chót: gộp mọi thẻ của 1 người trong 1 lượt quét vào 1 email (quá hạn trước). */
export function dueReminderMessage(input: { to: string; name: string; items: DueReminderItem[]; homeUrl: string; settingsUrl: string }) {
  const overdue = input.items.filter((i) => i.kind === 'overdue');
  const soon = input.items.filter((i) => i.kind === 'soon');
  const [first] = input.items;
  const title = first.cardTitle.length > SUBJECT_TITLE_LENGTH ? `${first.cardTitle.slice(0, SUBJECT_TITLE_LENGTH - 1)}…` : first.cardTitle;
  const subject =
    input.items.length === 1
      ? `Thẻ "${title}" ${first.kind === 'overdue' ? 'đã quá hạn' : 'sắp hết hạn'}`
      : `Bạn có ${[overdue.length && `${overdue.length} thẻ quá hạn`, soon.length && `${soon.length} thẻ sắp hết hạn`].filter(Boolean).join(' và ')}`;
  const line = (i: DueReminderItem) =>
    `<a href="${escapeHtml(i.url)}" style="color:#0c66e4;font-weight:600">${escapeHtml(i.cardTitle)}</a> · ${escapeHtml(i.boardTitle)}<br>` +
    (i.kind === 'overdue'
      ? `<span style="color:#ba1a1a">Đã quá hạn từ ${i.due}</span>`
      : `<span style="color:#7f5f01">Hết hạn lúc ${i.due}</span>`);
  return layout({
    to: input.to,
    subject,
    heading: `Chào ${escapeHtml(input.name)},`,
    paragraphs: [
      input.items.length === 1 ? 'Nhắc hạn chót thẻ đang được giao cho bạn:' : 'Nhắc hạn chót các thẻ đang được giao cho bạn:',
      ...overdue.map(line),
      ...soon.map(line),
    ],
    button: 'Xem thẻ của tôi',
    url: input.homeUrl,
    note: `Bạn nhận email này vì đang được giao các thẻ trên. Tắt email nhắc hạn tại <a href="${escapeHtml(input.settingsUrl)}" style="color:#727786">Tài khoản → Thông báo</a> (thông báo trong app vẫn giữ).`,
  });
}
