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
