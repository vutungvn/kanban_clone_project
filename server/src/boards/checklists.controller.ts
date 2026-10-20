import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiAuth, ApiForbidden, ApiNotFound, ApiValidationError } from '../common/swagger/api-responses';
import { CARD_NOT_FOUND } from './cards.service';
import { CHECKLIST_ITEM_NOT_FOUND, CHECKLIST_NOT_FOUND, ChecklistsService } from './checklists.service';
import {
  ChecklistItemResponseDto,
  ChecklistResponseDto,
  CreateChecklistDto,
  CreateChecklistItemDto,
  UpdateChecklistDto,
  UpdateChecklistItemDto,
} from './dto/checklist.dto';

const VIEWER_FORBIDDEN = 'Bạn chỉ có quyền xem bảng này';

@ApiTags('Checklists')
@ApiAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ChecklistsController {
  constructor(private readonly checklists: ChecklistsService) {}

  @ApiOperation({ summary: 'Thêm checklist', description: 'Thêm vào cuối thẻ. Cần vai trò MEMBER trở lên.' })
  @ApiParam({ name: 'cardId', description: 'ID thẻ' })
  @ApiCreatedResponse({ type: ChecklistResponseDto })
  @ApiValidationError(['Vui lòng nhập tên checklist'])
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(CARD_NOT_FOUND)
  @Post('cards/:cardId/checklists')
  async create(@CurrentUser() user: AuthUser, @Param('cardId') cardId: string, @Body() dto: CreateChecklistDto) {
    return { checklist: await this.checklists.create(cardId, user.id, dto) };
  }

  @ApiOperation({ summary: 'Đổi tên checklist' })
  @ApiParam({ name: 'id', description: 'ID checklist' })
  @ApiOkResponse({ type: ChecklistResponseDto })
  @ApiValidationError(['Vui lòng nhập tên checklist'])
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(CHECKLIST_NOT_FOUND)
  @Patch('checklists/:id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateChecklistDto) {
    return { checklist: await this.checklists.update(id, user.id, dto) };
  }

  @ApiOperation({ summary: 'Xoá checklist', description: 'Xoá vĩnh viễn checklist và mọi mục bên trong.' })
  @ApiParam({ name: 'id', description: 'ID checklist' })
  @ApiNoContentResponse({ description: 'Đã xoá' })
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(CHECKLIST_NOT_FOUND)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('checklists/:id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.checklists.remove(id, user.id);
  }

  @ApiOperation({ summary: 'Thêm mục vào checklist', description: 'Thêm vào cuối checklist.' })
  @ApiParam({ name: 'checklistId', description: 'ID checklist' })
  @ApiCreatedResponse({ type: ChecklistItemResponseDto })
  @ApiValidationError(['Vui lòng nhập nội dung mục'])
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(CHECKLIST_NOT_FOUND)
  @Post('checklists/:checklistId/items')
  async addItem(
    @CurrentUser() user: AuthUser,
    @Param('checklistId') checklistId: string,
    @Body() dto: CreateChecklistItemDto,
  ) {
    return { item: await this.checklists.addItem(checklistId, user.id, dto) };
  }

  @ApiOperation({ summary: 'Sửa mục', description: 'Đổi nội dung và/hoặc đánh dấu hoàn thành. Chỉ gửi trường cần đổi.' })
  @ApiParam({ name: 'id', description: 'ID mục' })
  @ApiOkResponse({ type: ChecklistItemResponseDto })
  @ApiValidationError(['completed phải là true hoặc false'])
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(CHECKLIST_ITEM_NOT_FOUND)
  @Patch('checklist-items/:id')
  async updateItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateChecklistItemDto) {
    return { item: await this.checklists.updateItem(id, user.id, dto) };
  }

  @ApiOperation({ summary: 'Xoá mục' })
  @ApiParam({ name: 'id', description: 'ID mục' })
  @ApiNoContentResponse({ description: 'Đã xoá' })
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(CHECKLIST_ITEM_NOT_FOUND)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('checklist-items/:id')
  async removeItem(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.checklists.removeItem(id, user.id);
  }
}
