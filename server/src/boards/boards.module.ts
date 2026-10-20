import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BoardAccessService } from './board-access.service';
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

/** Bảng, thành viên, liên kết mời, danh sách, thẻ, nhãn, checklist — gom chung vì luôn đi cùng nhau và dùng chung kiểm tra quyền. */
@Module({
  imports: [AuthModule],
  controllers: [
    BoardsController,
    MembersController,
    BoardInvitesController,
    InvitesController,
    ListsController,
    CardsController,
    LabelsController,
    ChecklistsController,
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
  ],
  // Export để socket gateway (real-time) dùng lại khi kiểm tra quyền vào room
  exports: [BoardAccessService],
})
export class BoardsModule {}
