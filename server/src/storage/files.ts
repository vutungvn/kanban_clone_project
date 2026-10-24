import { extname } from 'node:path';

/** Dung lượng tối đa 1 tệp đính kèm (giới hạn của gói Cloudinary free cũng là 10 MB). */
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const MAX_ATTACHMENT_NAME = 255;

/**
 * Ảnh trình duyệt hiển thị được → lưu dạng ảnh (có ảnh thu nhỏ, làm ảnh bìa được).
 * SVG cố ý coi là tệp thường: SVG chứa được script.
 */
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const isImageType = (mimeType: string) => IMAGE_TYPES.includes(mimeType);

/** Phần tệp upload mà service cần (khớp Express.Multer.File). */
export interface UploadedFileData {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * Tên tệp gốc. Trình duyệt gửi tên dạng UTF-8 nhưng multer đọc thành latin1 → tên tiếng Việt bị lỗi font;
 * đổi lại về UTF-8 khi chuỗi trông như vậy.
 */
export function fileNameOf(file: Pick<UploadedFileData, 'originalname'>) {
  let name = file.originalname;
  if (/[\u0080-ÿ]/.test(name) && !/[^\u0000-ÿ]/.test(name)) {
    const utf8 = Buffer.from(name, 'latin1').toString('utf8');
    if (!utf8.includes('�')) name = utf8;
  }
  name = name.normalize('NFC').trim();
  return (name || 'tep-dinh-kem').slice(0, MAX_ATTACHMENT_NAME);
}

/** Đuôi tệp an toàn để đặt tên trên nơi lưu (vd ".pdf"); lạ / quá dài thì bỏ. */
export function safeExtension(name: string) {
  const ext = extname(name).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : '';
}

/** Ảnh thu nhỏ để hiển thị trên thẻ / trong modal: Cloudinary tự co (rộng tối đa 600px, tự chọn định dạng + chất lượng). */
export function previewUrl(file: { url: string; mimeType: string }) {
  if (!isImageType(file.mimeType)) return null;
  return file.url.includes('/image/upload/')
    ? file.url.replace('/image/upload/', '/image/upload/c_limit,w_600,f_auto,q_auto/')
    : file.url;
}
