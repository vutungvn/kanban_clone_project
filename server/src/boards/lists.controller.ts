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
import {
  ArchiveCountDto,
  CopyListDto,
  CreateListDto,
  ListResponseDto,
  MoveListDto,
  SortListDto,
  UpdateListDto,
} from './dto/list.dto';
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

  @ApiOperation({
    summary: 'Di chuyển danh sách (kéo thả / sang bảng khác)',
    description:
      'Chuyển danh sách tới vị trí `index` trong bảng. Server tự tính `position` từ thứ tự hiện tại trong DB; ' +
      'khi các position quá sát nhau sẽ tự đánh số lại cả bảng.',
  })
  @ApiParam({ name: 'id', description: 'ID danh sách' })
  @ApiOkResponse({ type: ListResponseDto })
  @ApiValidationError(['index phải là số nguyên', 'index không được âm'])
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(LIST_NOT_FOUND)
  @Patch('lists/:id/move')
  async move(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MoveListDto) {
    return { list: await this.lists.move(id, user.id, dto) };
  }

  @ApiOperation({
    summary: 'Sắp xếp thẻ trong danh sách',
    description: 'Sắp xếp một lần và lưu thứ tự mới (thẻ thêm sau vẫn vào cuối).',
  })
  @ApiParam({ name: 'id', description: 'ID danh sách' })
  @ApiOkResponse({ type: ListResponseDto })
  @ApiValidationError(['Kiểu sắp xếp phải là một trong: newest, oldest, due, title'])
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(LIST_NOT_FOUND)
  @HttpCode(HttpStatus.OK)
  @Post('lists/:id/sort')
  async sort(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SortListDto) {
    return { list: await this.lists.sort(id, user.id, dto.by) };
  }

  @ApiOperation({ summary: 'Lưu trữ danh sách', description: 'Ẩn danh sách cùng mọi thẻ bên trong khỏi bảng, giữ nguyên vị trí.' })
  @ApiParam({ name: 'id', description: 'ID danh sách' })
  @ApiOkResponse({ type: ListResponseDto })
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(LIST_NOT_FOUND)
  @HttpCode(HttpStatus.OK)
  @Post('lists/:id/archive')
  async archive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return { list: await this.lists.setArchived(id, user.id, true) };
  }

  @ApiOperation({ summary: 'Khôi phục danh sách', description: 'Đưa danh sách (và các thẻ bên trong) về đúng vị trí cũ.' })
  @ApiParam({ name: 'id', description: 'ID danh sách' })
  @ApiOkResponse({ type: ListResponseDto })
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(LIST_NOT_FOUND)
  @HttpCode(HttpStatus.OK)
  @Post('lists/:id/restore')
  async restore(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return { list: await this.lists.setArchived(id, user.id, false) };
  }

  @ApiOperation({ summary: 'Lưu trữ mọi thẻ trong danh sách', description: 'Danh sách vẫn giữ trên bảng.' })
  @ApiParam({ name: 'id', description: 'ID danh sách' })
  @ApiOkResponse({ type: ArchiveCountDto })
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(LIST_NOT_FOUND)
  @HttpCode(HttpStatus.OK)
  @Post('lists/:id/archive-cards')
  archiveCards(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.lists.archiveCards(id, user.id);
  }

  @ApiOperation({
    summary: 'Sao chép danh sách',
    description: 'Tạo danh sách mới ngay bên phải, kèm mọi thẻ đang hiện (giữ nhãn, thành viên, checklist, ngày).',
  })
  @ApiParam({ name: 'id', description: 'ID danh sách gốc' })
  @ApiCreatedResponse({ type: ListResponseDto })
  @ApiValidationError(['Vui lòng nhập tên danh sách'])
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(LIST_NOT_FOUND)
  @Post('lists/:id/copy')
  async copy(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CopyListDto) {
    return { list: await this.lists.copy(id, user.id, dto) };
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
