import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkspaceAccessService } from './workspace-access.service';
import { WorkspaceMembersController } from './workspace-members.controller';
import { WorkspaceMembersService } from './workspace-members.service';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

/** Không gian làm việc: nhóm bảng theo đội / công ty. */
@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [WorkspacesController, WorkspaceMembersController],
  providers: [WorkspacesService, WorkspaceAccessService, WorkspaceMembersService],
  // BoardsModule / TemplatesModule dùng để chọn không gian cho bảng mới và kiểm tra quyền
  exports: [WorkspaceAccessService],
})
export class WorkspacesModule {}
