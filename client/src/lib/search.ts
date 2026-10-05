/** Bỏ dấu tiếng Việt + chữ thường, để gõ "du an" vẫn tìm ra "Dự án". */
export function normalizeText(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function matchesQuery(text: string, query: string) {
  const q = normalizeText(query.trim());
  return !q || normalizeText(text).includes(q);
}
