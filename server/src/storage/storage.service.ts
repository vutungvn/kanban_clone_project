import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { isImageType, safeExtension } from './files';

export const UPLOAD_FAILED = 'Không tải được tệp lên, vui lòng thử lại';
export const STORAGE_NOT_CONFIGURED = 'Máy chủ chưa cấu hình nơi lưu tệp đính kèm';

/** Thư mục lưu tệp khi chưa cấu hình Cloudinary (chỉ dùng khi dev). Phục vụ tại /api/uploads. */
export const LOCAL_UPLOAD_DIR = join(process.cwd(), 'uploads');
export const LOCAL_UPLOAD_PREFIX = '/api/uploads';

export interface StoredFile {
  storageKey: string;
  url: string;
  width: number | null;
  height: number | null;
}

/**
 * Nơi lưu tệp đính kèm. Có đủ CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET → Cloudinary;
 * không có → ổ đĩa (thư mục uploads/) để dev chạy được ngay. Production bắt buộc Cloudinary
 * (ổ đĩa của Render bị xoá mỗi lần deploy).
 *
 * storageKey: "image:<public_id>" / "raw:<public_id>" (Cloudinary) hoặc "local:<tên tệp>".
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly folder: string;
  private readonly localBaseUrl: string;
  readonly usesCloudinary: boolean;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = config.get<string>('CLOUDINARY_API_SECRET');
    this.usesCloudinary = !!(cloudName && apiKey && apiSecret);
    if (this.usesCloudinary) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    }
    // Dev và production dùng chung 1 tài khoản Cloudinary → tách thư mục
    this.folder = config.get('CLOUDINARY_FOLDER', process.env.NODE_ENV === 'production' ? 'kanban' : 'kanban-dev');
    this.localBaseUrl = `http://localhost:${config.get('PORT', 4000)}${LOCAL_UPLOAD_PREFIX}`;
  }

  async upload(file: { buffer: Buffer; mimeType: string; name: string }): Promise<StoredFile> {
    if (this.usesCloudinary) return this.uploadToCloudinary(file);
    if (process.env.NODE_ENV === 'production') throw new ServiceUnavailableException(STORAGE_NOT_CONFIGURED);
    return this.saveLocally(file);
  }

  /** storageKey của mọi tệp đính kèm khớp điều kiện — đọc trước khi xoá thẻ / danh sách / bảng. */
  async keysOf(where: Prisma.AttachmentWhereInput) {
    const rows = await this.prisma.attachment.findMany({ where, select: { storageKey: true }, distinct: ['storageKey'] });
    return rows.map((r) => r.storageKey);
  }

  /**
   * Xoá tệp thật của các key không còn dòng Attachment nào dùng (bản sao thẻ dùng chung tệp).
   * Gọi sau khi đã xoá trong DB; lỗi chỉ ghi log — không làm hỏng thao tác của người dùng.
   */
  async discard(keys: string[]) {
    if (!keys.length) return;
    try {
      const used = await this.keysOf({ storageKey: { in: keys } });
      const unused = [...new Set(keys)].filter((k) => !used.includes(k));
      const results = await Promise.allSettled(unused.map((key) => this.removeFile(key)));
      results.forEach((r, i) => {
        if (r.status === 'rejected') this.logger.warn(`Không xoá được tệp ${unused[i]}: ${String(r.reason)}`);
      });
    } catch (e) {
      this.logger.warn(`Không dọn được tệp đính kèm: ${String(e)}`);
    }
  }

  private uploadToCloudinary(file: { buffer: Buffer; mimeType: string; name: string }) {
    const resourceType = isImageType(file.mimeType) ? 'image' : 'raw';
    return new Promise<StoredFile>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: this.folder,
          resource_type: resourceType,
          // Tệp thường: public_id phải kèm đuôi thì tải về mới đúng định dạng
          ...(resourceType === 'raw' && { public_id: `${randomUUID()}${safeExtension(file.name)}` }),
        },
        (error, result?: UploadApiResponse) => {
          if (error || !result) {
            this.logger.error(`Upload Cloudinary lỗi: ${error?.message ?? 'không có kết quả'}`);
            return reject(new ServiceUnavailableException(UPLOAD_FAILED));
          }
          resolve({
            storageKey: `${resourceType}:${result.public_id}`,
            url: result.secure_url,
            width: resourceType === 'image' ? (result.width ?? null) : null,
            height: resourceType === 'image' ? (result.height ?? null) : null,
          });
        },
      );
      stream.end(file.buffer);
    });
  }

  private async saveLocally(file: { buffer: Buffer; name: string }): Promise<StoredFile> {
    const fileName = `${randomUUID()}${safeExtension(file.name)}`;
    await mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
    await writeFile(join(LOCAL_UPLOAD_DIR, fileName), file.buffer);
    return { storageKey: `local:${fileName}`, url: `${this.localBaseUrl}/${fileName}`, width: null, height: null };
  }

  private async removeFile(key: string) {
    const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
    if (kind === 'local') {
      await unlink(join(LOCAL_UPLOAD_DIR, id.replace(/[\\/]/g, ''))).catch(() => undefined);
    } else if (this.usesCloudinary && (kind === 'image' || kind === 'raw')) {
      await cloudinary.uploader.destroy(id, { resource_type: kind, invalidate: true });
    }
  }
}
