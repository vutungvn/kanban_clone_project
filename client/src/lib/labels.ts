/**
 * Màu nhãn — key phải khớp server/src/boards/boards.constants.ts (LABEL_COLORS).
 * 10 màu × 3 sắc độ (nhạt / chuẩn / đậm), giống bảng màu nhãn của Trello.
 */
const HUES = [
  { key: 'green', name: 'xanh lá', shades: ['#baf3db', '#4bce97', '#1f845a'] },
  { key: 'yellow', name: 'vàng', shades: ['#f8e6a0', '#f5cd47', '#946f00'] },
  { key: 'orange', name: 'cam', shades: ['#fedec8', '#fea362', '#c25100'] },
  { key: 'red', name: 'đỏ', shades: ['#ffd5d2', '#f87168', '#c9372c'] },
  { key: 'purple', name: 'tím', shades: ['#dfd8fd', '#9f8fef', '#6e5dc6'] },
  { key: 'blue', name: 'xanh dương', shades: ['#cce0ff', '#579dff', '#0c66e4'] },
  { key: 'sky', name: 'xanh da trời', shades: ['#c6edfb', '#6cc3e0', '#227d9b'] },
  { key: 'lime', name: 'xanh chanh', shades: ['#d3f1a7', '#94c748', '#5b7f24'] },
  { key: 'pink', name: 'hồng', shades: ['#fdd0ec', '#e774bb', '#ae4787'] },
  { key: 'black', name: 'xám', shades: ['#dcdfe4', '#8590a2', '#626f86'] },
] as const;

const TONES = [
  { suffix: '_subtle', name: 'nhạt' },
  { suffix: '', name: '' },
  { suffix: '_bold', name: 'đậm' },
] as const;

type Hue = (typeof HUES)[number]['key'];
export type LabelColor = `${Hue}${(typeof TONES)[number]['suffix']}`;

export interface LabelColorInfo {
  key: LabelColor;
  /** Tên đọc được, vd "đỏ đậm" — dùng cho trình đọc màn hình và tooltip */
  name: string;
  bg: string;
  /** Màu chữ đủ tương phản trên nền */
  fg: string;
}

const INK = '#172b4d';

/** Thứ tự hiển thị ô chọn màu: theo hàng sắc độ (nhạt → chuẩn → đậm), mỗi hàng 5 màu — như Trello. */
export const LABEL_COLORS: LabelColorInfo[] = [HUES.slice(0, 5), HUES.slice(5)].flatMap((group) =>
  TONES.flatMap((tone, t) =>
    group.map((hue) => ({
      key: `${hue.key}${tone.suffix}` as LabelColor,
      name: tone.name ? `${hue.name} ${tone.name}` : hue.name,
      bg: hue.shades[t],
      fg: t === 2 ? '#ffffff' : INK,
    })),
  ),
);

const BY_KEY = new Map(LABEL_COLORS.map((c) => [c.key, c]));

/** Thông tin màu; key lạ (server thêm màu mới) → xám để không vỡ giao diện. */
export const labelColor = (key: string): LabelColorInfo => BY_KEY.get(key as LabelColor) ?? BY_KEY.get('black')!;

/** Tên hiển thị: nhãn không tên thì dùng tên màu. */
export const labelDisplayName = (label: { name: string; color: string }) =>
  label.name || `Nhãn ${labelColor(label.color).name}`;

export const MAX_LABEL_NAME = 50;
