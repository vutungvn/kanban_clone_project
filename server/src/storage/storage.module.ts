import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/** Global: xoá thẻ / danh sách / bảng đều phải dọn tệp đính kèm. */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
