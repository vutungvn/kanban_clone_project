import { normalizeText } from './search';

/**
 * Nhắc tên: `@` + họ tên đầy đủ của thành viên bảng, không phân biệt hoa thường.
 * Trước `@` và sau tên phải là đầu/cuối chuỗi hoặc ký tự không phải chữ / số
 * (cùng quy tắc với server/src/boards/mentions.ts — server quyết định ai nhận thông báo).
 */
const WORD_CHAR = /[\p{L}\p{N}_]/u;
const MAX_QUERY = 40;

export interface MentionMember {
  id: string;
  name: string;
}

/** Đang gõ `@...` ngay trước con trỏ? Trả về vị trí `@` và phần đã gõ sau nó. */
export function mentionQuery(text: string, caret: number) {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at < 0 || (at > 0 && WORD_CHAR.test(before[at - 1]))) return null;
  const query = before.slice(at + 1);
  if (query.length > MAX_QUERY || /\n|\s\s/.test(query)) return null;
  return { start: at, query };
}

/** Thành viên khớp phần đã gõ: tên bắt đầu bằng / có từ bắt đầu bằng / chứa chuỗi (không dấu). */
export function matchMembers(members: MentionMember[], query: string, limit = 6) {
  const q = normalizeText(query.trim());
  const rank = (m: MentionMember) => {
    const name = normalizeText(m.name);
    if (!q || name.startsWith(q)) return 0;
    if (name.split(/\s+/).some((word) => word.startsWith(q))) return 1;
    return name.includes(q) ? 2 : -1;
  };
  return members
    .map((m) => ({ m, r: rank(m) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.m.name.localeCompare(b.m.name, 'vi'))
    .slice(0, limit)
    .map((x) => x.m);
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Tách nội dung bình luận thành đoạn thường và đoạn nhắc tên (để tô màu). Tên dài khớp trước. */
export function splitMentions(text: string, members: MentionMember[]) {
  const named = members.filter((m) => m.name.trim()).sort((a, b) => b.name.length - a.name.length);
  if (!named.length || !text.includes('@')) return [{ text }];
  const pattern = new RegExp(`@(${named.map((m) => escapeRegExp(m.name.trim())).join('|')})`, 'giu');
  const parts: { text: string; memberId?: string }[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    const end = start + match[0].length;
    if ((start > 0 && WORD_CHAR.test(text[start - 1])) || (end < text.length && WORD_CHAR.test(text[end]))) continue;
    const lower = match[1].toLocaleLowerCase('vi');
    const member = named.find((m) => m.name.trim().toLocaleLowerCase('vi') === lower);
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: match[0], memberId: member?.id });
    last = end;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
