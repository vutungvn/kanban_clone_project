import type { MailMessage } from './mail.service';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

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
    input.heading,
    '',
    ...input.paragraphs.map((p) => p.replace(/<[^>]+>/g, '')),
    '',
    `${input.button}: ${input.url}`,
    '',
    input.note,
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
