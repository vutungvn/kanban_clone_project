import type { Attachment, Card } from './boards-api';
import { LABEL_COLORS } from './labels';

/** Khớp server/src/storage/files.ts */
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const MAX_ATTACHMENT_NAME = 255;

/** Màu ảnh bìa: 10 màu chuẩn của nhãn (key không có hậu tố _subtle / _bold). */
export const COVER_COLORS = LABEL_COLORS.filter((c) => !c.key.includes('_'));
export const coverColorHex = (key: string) => COVER_COLORS.find((c) => c.key === key)?.bg ?? COVER_COLORS[0].bg;

/** Ảnh hiển thị được (có ảnh thu nhỏ, làm ảnh bìa được). */
export const isImage = (a: Attachment) => !!a.previewUrl;

/** Ảnh bìa của thẻ: màu, ảnh, hoặc null. Ảnh bìa trỏ tới tệp không còn (đang đồng bộ) → coi như không có. */
export function cardCover(card: Card): { color: string } | { image: Attachment } | null {
  if (card.coverColor) return { color: coverColorHex(card.coverColor) };
  const image = card.coverAttachmentId ? card.attachments.find((a) => a.id === card.coverAttachmentId) : undefined;
  return image?.previewUrl ? { image } : null;
}

/** "512 KB", "1,5 MB" */
export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`;
}

/** Đuôi tệp viết hoa để hiện trên ô thu nhỏ của tệp không phải ảnh ("PDF", "DOCX"...). */
export function fileExtension(name: string) {
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1) : '';
  return /^[a-z0-9]{1,5}$/i.test(ext) ? ext.toUpperCase() : 'TỆP';
}

/**
 * Tải tệp về đúng tên gốc. Tệp nằm ở domain khác (Cloudinary) nên thuộc tính `download` của thẻ <a> không có tác dụng
 * → tải về dạng blob rồi lưu; không tải được (CORS, mạng) thì mở ở tab mới.
 */
export async function downloadAttachment(a: Attachment) {
  try {
    const res = await fetch(a.url);
    if (!res.ok) throw new Error(String(res.status));
    const blobUrl = URL.createObjectURL(await res.blob());
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = a.name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
  } catch {
    window.open(a.url, '_blank', 'noopener,noreferrer');
  }
}
