import { Matches } from 'class-validator';

/** Đường dẫn nội bộ để quay lại sau khi xác minh email (vd liên kết mời) — chặn "//evil.com", "https://...". */
export const NextPath = () => Matches(/^\/(?!\/)[^\s\\]*$/, { message: 'next phải là đường dẫn nội bộ' });
