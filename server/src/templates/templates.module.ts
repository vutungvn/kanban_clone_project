import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BoardsModule } from '../boards/boards.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';

/** Mẫu bảng: mẫu có sẵn + mẫu của tôi; tạo bảng từ mẫu, lưu bảng thành mẫu. */
@Module({
  imports: [AuthModule, BoardsModule, WorkspacesModule],
  controllers: [TemplatesController],
  providers: [TemplatesService],
})
export class TemplatesModule {}
