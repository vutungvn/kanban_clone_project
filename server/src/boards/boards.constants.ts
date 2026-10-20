import { BoardRole } from '@prisma/client';

/** Key phông nền dựng sẵn — phải khớp client/src/lib/board-backgrounds.ts */
export const BOARD_BACKGROUNDS = ['blue', 'purple', 'sunset', 'green', 'teal', 'dark'] as const;
export type BoardBackground = (typeof BOARD_BACKGROUNDS)[number];

/** Khoảng cách position giữa 2 phần tử liền kề khi thêm vào cuối */
export const POSITION_GAP = 1024;

/** Thứ bậc quyền: ADMIN ⊃ MEMBER ⊃ VIEWER */
export const ROLE_RANK: Record<BoardRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
};

export const MAX_BOARD_TITLE = 100;
export const MAX_LIST_TITLE = 100;
export const MAX_CARD_TITLE = 500;
export const MAX_CARD_DESCRIPTION = 10_000;

/**
 * Key màu nhãn — phải khớp client/src/lib/labels.ts.
 * 10 màu × 3 sắc độ: `<màu>_subtle` (nhạt), `<màu>` (chuẩn), `<màu>_bold` (đậm).
 */
const LABEL_HUES = ['green', 'yellow', 'orange', 'red', 'purple', 'blue', 'sky', 'lime', 'pink', 'black'] as const;
export const LABEL_COLORS = LABEL_HUES.flatMap((hue) => [`${hue}_subtle`, hue, `${hue}_bold`]);

/** Nhãn tạo sẵn (không tên) cho mỗi bảng mới — giống Trello */
export const DEFAULT_LABEL_COLORS = ['green', 'yellow', 'orange', 'red', 'purple', 'blue'];

export const MAX_LABEL_NAME = 50;
export const MAX_CHECKLIST_TITLE = 255;
export const MAX_CHECKLIST_ITEM_TITLE = 500;
