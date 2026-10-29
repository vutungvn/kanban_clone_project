import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceAccessService } from './workspace-access.service';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

/** Không gian làm việc: nhóm bảng theo đội / công ty. */
@Module({
  imports: [AuthModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspaceAccessService],
  // BoardsModule / TemplatesModule dùng để chọn không gian cho bảng mới và kiểm tra quyền
  exports: [WorkspaceAccessService],
})
export class WorkspacesModule {}
