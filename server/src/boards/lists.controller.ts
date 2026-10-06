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
import { BOARD_NOT_FOUND } from './board-access.service';
import { CreateListDto, ListResponseDto, UpdateListDto } from './dto/list.dto';
import { LIST_NOT_FOUND, ListsService } from './lists.service';

const VIEWER_FORBIDDEN = 'Bạn chỉ có quyền xem bảng này';

@ApiTags('Lists')
@ApiAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ListsController {
  constructor(private readonly lists: ListsService) {}

  @ApiOperation({ summary: 'Thêm danh sách', description: 'Thêm vào cuối bảng. Cần vai trò MEMBER trở lên.' })
  @ApiParam({ name: 'boardId', description: 'ID bảng' })
  @ApiCreatedResponse({ type: ListResponseDto })
  @ApiValidationError(['Vui lòng nhập tên danh sách'])
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(BOARD_NOT_FOUND)
  @Post('boards/:boardId/lists')
  async create(@CurrentUser() user: AuthUser, @Param('boardId') boardId: string, @Body() dto: CreateListDto) {
    return { list: await this.lists.create(boardId, user.id, dto) };
  }

  @ApiOperation({ summary: 'Đổi tên danh sách' })
  @ApiParam({ name: 'id', description: 'ID danh sách' })
  @ApiOkResponse({ type: ListResponseDto })
  @ApiValidationError(['Vui lòng nhập tên danh sách'])
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(LIST_NOT_FOUND)
  @Patch('lists/:id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateListDto) {
    return { list: await this.lists.update(id, user.id, dto) };
  }

  @ApiOperation({ summary: 'Xoá danh sách', description: 'Xoá vĩnh viễn danh sách và mọi thẻ bên trong.' })
  @ApiParam({ name: 'id', description: 'ID danh sách' })
  @ApiNoContentResponse({ description: 'Đã xoá' })
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(LIST_NOT_FOUND)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('lists/:id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.lists.remove(id, user.id);
  }
}
