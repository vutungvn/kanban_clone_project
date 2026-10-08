import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BoardAccessService } from './board-access.service';
import { BoardsController } from './boards.controller';
import { BoardsService } from './boards.service';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { BoardInvitesController, InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { ListsController } from './lists.controller';
import { ListsService } from './lists.service';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

/** Bảng, thành viên, liên kết mời, danh sách, thẻ — gom chung vì luôn đi cùng nhau và dùng chung kiểm tra quyền. */
@Module({
  imports: [AuthModule],
  controllers: [BoardsController, MembersController, BoardInvitesController, InvitesController, ListsController, CardsController],
  providers: [BoardAccessService, BoardsService, MembersService, InvitesService, ListsService, CardsService],
  // Export để socket gateway (real-time) dùng lại khi kiểm tra quyền vào room
  exports: [BoardAccessService],
})
export class BoardsModule {}
