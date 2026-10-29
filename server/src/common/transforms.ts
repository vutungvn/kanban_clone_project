/** Dùng với @Transform: cắt khoảng trắng 2 đầu nếu là chuỗi. */
export const trimString = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Dùng với @Transform cho query string: "true" / "false" → boolean (giá trị khác giữ nguyên để validator báo lỗi). */
export const queryBoolean = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value);

/** Dùng với @Transform: chuỗi rỗng/toàn khoảng trắng → null (để xoá giá trị). */
export const blankToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : value;
