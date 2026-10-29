/** Số từ khoá tối đa lấy từ chuỗi gõ (phần sau bị bỏ) */
const MAX_TERMS = 8;
/** Một "từ": chuỗi chữ / số liền nhau — khớp cách Postgres tách từ (ký tự khác bị bỏ, không làm hỏng tsquery) */
const WORD = /[\p{L}\p{N}]+/gu;
const WORD_CHAR = /[\p{L}\p{N}]/u;

/** Bỏ dấu + chữ thường — giống `f_unaccent` + `to_tsvector('simple')` của Postgres ở mức đủ dùng. */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

/** "Thiết kế  trang-chủ!" → ["thiet", "ke", "trang", "chu"] (bỏ trùng, tối đa MAX_TERMS). */
export function searchTerms(q: string) {
  const terms = (q.match(WORD) ?? []).map(fold).filter(Boolean);
  return [...new Set(terms)].slice(0, MAX_TERMS);
}

/**
 * Từ khoá → tsquery: mọi từ đều phải có (&), mỗi từ khớp đầu từ (:*) để tìm được khi đang gõ dở.
 * `weight` = chỉ khớp phần có trọng số đó (A = tiêu đề thẻ).
 */
export const toTsQuery = (terms: string[], weight = '') => terms.map((t) => `${t}:*${weight}`).join(' & ');

/**
 * Vị trí (trong `text`) nên đặt đoạn trích: chỗ khớp mà trong khoảng `span` ký tự tiếp theo gom được nhiều từ khoá
 * khác nhau nhất (bằng nhau → chỗ sớm hơn). Tránh trích nhầm chỗ chỉ khớp 1 từ ngắn — vd "ke" khớp đầu "kết quả"
 * trong khi "thiết kế" nằm ở sau. Khớp = đầu từ khớp tiền tố với từ khoá (giống tsquery `:*`). Không thấy → -1.
 */
function bestMatch(text: string, terms: string[], span: number) {
  // Bỏ dấu từng ký tự, nhớ vị trí gốc — để vị trí tìm được trên chuỗi đã bỏ dấu đổi lại được về chuỗi gốc
  let folded = '';
  const origin: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const f = fold(text[i]);
    folded += f;
    for (let k = 0; k < f.length; k++) origin.push(i);
  }
  const hits: { pos: number; term: string }[] = [];
  for (const term of terms) {
    for (let i = folded.indexOf(term); i >= 0; i = folded.indexOf(term, i + 1)) {
      if (i === 0 || !WORD_CHAR.test(folded[i - 1])) hits.push({ pos: origin[i], term });
    }
  }
  hits.sort((x, y) => x.pos - y.pos);
  let best = -1;
  let bestCount = 0;
  for (const hit of hits) {
    const count = new Set(hits.filter((h) => h.pos >= hit.pos && h.pos < hit.pos + span).map((h) => h.term)).size;
    if (count > bestCount) {
      best = hit.pos;
      bestCount = count;
    }
  }
  return best;
}

/** Đoạn trích khoảng `length` ký tự quanh chỗ khớp tốt nhất (cắt ở ranh giới từ, thêm "…"); không thấy chỗ khớp → đầu văn bản. */
export function excerptAround(text: string, terms: string[], length = 160) {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= length) return flat;
  const pos = Math.max(0, bestMatch(flat, terms, Math.floor((length * 2) / 3)));
  let start = Math.max(0, pos - Math.floor(length / 3));
  let end = Math.min(flat.length, start + length);
  start = Math.max(0, end - length);
  if (start > 0) {
    const space = flat.indexOf(' ', start);
    if (space >= 0 && space < pos) start = space + 1;
  }
  if (end < flat.length) {
    const space = flat.lastIndexOf(' ', end);
    if (space > Math.max(start, pos)) end = space;
  }
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`;
}
