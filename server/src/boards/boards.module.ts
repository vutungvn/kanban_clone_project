import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { BoardAccessService } from './board-access.service';
import { BoardsGateway } from './boards.gateway';
import { BoardsController } from './boards.controller';
import { BoardsService } from './boards.service';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { ChecklistsController } from './checklists.controller';
import { ChecklistsService } from './checklists.service';
import { BoardInvitesController, InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { LabelsController } from './labels.controller';
import { LabelsService } from './labels.service';
import { ListsController } from './lists.controller';
import { ListsService } from './lists.service';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

/** Bảng, thành viên, liên kết mời, danh sách, thẻ, nhãn, checklist, hoạt động — gom chung vì luôn đi cùng nhau và dùng chung kiểm tra quyền. */
@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [
    BoardsController,
    MembersController,
    BoardInvitesController,
    InvitesController,
    ListsController,
    CardsController,
    LabelsController,
    ChecklistsController,
    ActivitiesController,
  ],
  providers: [
    BoardAccessService,
    BoardsService,
    MembersService,
    InvitesService,
    ListsService,
    CardsService,
    LabelsService,
    ChecklistsService,
    ActivitiesService,
    BoardsGateway,
  ],
  // Export để module khác dùng lại kiểm tra quyền trong bảng
  exports: [BoardAccessService],
})
export class BoardsModule {}
