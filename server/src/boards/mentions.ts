/**
 * Nhắc tên trong bình luận: `@` + họ tên đầy đủ của thành viên bảng (vd "@Nguyễn Văn An"),
 * không phân biệt hoa thường. Sau tên phải là hết chuỗi hoặc ký tự không phải chữ / số
 * — "@An" không khớp "@Anh". Client dùng cùng quy tắc (client/src/lib/mentions.ts).
 */
const WORD_CHAR = /[\p{L}\p{N}_]/u;

const normalize = (s: string) => s.normalize('NFC').toLocaleLowerCase('vi');

/** ID các thành viên được nhắc tên trong `text`. */
export function findMentions(text: string, members: { id: string; name: string }[]) {
  const haystack = normalize(text);
  const ids = new Set<string>();
  for (const member of members) {
    const needle = `@${normalize(member.name.trim())}`;
    if (needle.length < 2) continue;
    for (let i = haystack.indexOf(needle); i >= 0; i = haystack.indexOf(needle, i + 1)) {
      const before = haystack[i - 1];
      const after = haystack[i + needle.length];
      if ((before === undefined || !WORD_CHAR.test(before)) && (after === undefined || !WORD_CHAR.test(after))) {
        ids.add(member.id);
        break;
      }
    }
  }
  return ids;
}
