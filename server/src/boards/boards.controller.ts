import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
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
import { BoardsService } from './boards.service';
import {
  BoardArchiveResponseDto,
  BoardDetailResponseDto,
  BoardsResponseDto,
  BoardSummaryResponseDto,
  CreateBoardDto,
  StarBoardDto,
  StarResponseDto,
  UpdateBoardDto,
} from './dto/board.dto';
import { ListSummariesResponseDto } from './dto/list.dto';

const ADMIN_ONLY = 'Chỉ quản trị viên của bảng mới được thực hiện thao tác này';

@ApiTags('Boards')
@ApiAuth()
@UseGuards(JwtAuthGuard)
@Controller('boards')
export class BoardsController {
  constructor(private readonly boards: BoardsService) {}

  @ApiOperation({
    summary: 'Danh sách bảng của tôi',
    description: 'Mọi bảng user là thành viên, kèm trạng thái đánh dấu sao / lần xem gần nhất của chính user.',
  })
  @ApiOkResponse({ type: BoardsResponseDto })
  @Get()
  async findAll(@CurrentUser() user: AuthUser) {
    return { boards: await this.boards.listForUser(user.id) };
  }

  @ApiOperation({ summary: 'Tạo bảng', description: 'Người tạo trở thành quản trị viên (ADMIN) của bảng.' })
  @ApiCreatedResponse({ type: BoardSummaryResponseDto })
  @ApiValidationError(['Vui lòng nhập tiêu đề bảng', 'Phông nền phải là một trong: blue, purple, sunset, green, teal, dark'])
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateBoardDto) {
    return { board: await this.boards.create(user.id, dto) };
  }

  @ApiOperation({
    summary: 'Chi tiết bảng',
    description: 'Trả về bảng kèm danh sách và thẻ (đã sắp xếp). Đồng thời cập nhật `lastViewedAt` của user.',
  })
  @ApiParam({ name: 'id', description: 'ID bảng' })
  @ApiOkResponse({ type: BoardDetailResponseDto })
  @ApiNotFound(BOARD_NOT_FOUND)
  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return { board: await this.boards.findOne(id, user.id) };
  }

  @ApiOperation({ summary: 'Sửa bảng', description: 'Đổi tên và/hoặc phông nền. Chỉ ADMIN.' })
  @ApiParam({ name: 'id', description: 'ID bảng' })
  @ApiOkResponse({ type: BoardSummaryResponseDto })
  @ApiValidationError(['Tiêu đề bảng tối đa 100 ký tự'])
  @ApiForbidden(ADMIN_ONLY)
  @ApiNotFound(BOARD_NOT_FOUND)
  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateBoardDto) {
    return { board: await this.boards.update(id, user.id, dto) };
  }

  @ApiOperation({ summary: 'Xoá bảng', description: 'Xoá vĩnh viễn bảng cùng mọi danh sách và thẻ. Chỉ ADMIN.' })
  @ApiParam({ name: 'id', description: 'ID bảng' })
  @ApiNoContentResponse({ description: 'Đã xoá' })
  @ApiForbidden(ADMIN_ONLY)
  @ApiNotFound(BOARD_NOT_FOUND)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.boards.remove(id, user.id);
  }

  @ApiOperation({
    summary: 'Danh sách của bảng (rút gọn)',
    description: 'Tên + số thẻ của các danh sách chưa lưu trữ — dùng khi chọn nơi di chuyển / sao chép sang bảng này.',
  })
  @ApiParam({ name: 'id', description: 'ID bảng' })
  @ApiOkResponse({ type: ListSummariesResponseDto })
  @ApiNotFound(BOARD_NOT_FOUND)
  @Get(':id/lists')
  async lists(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return { lists: await this.boards.listSummaries(id, user.id) };
  }

  @ApiOperation({
    summary: 'Mục đã lưu trữ',
    description: 'Thẻ lưu trữ riêng lẻ và danh sách đã lưu trữ của bảng (mới nhất trước). Mọi vai trò đều xem được.',
  })
  @ApiParam({ name: 'id', description: 'ID bảng' })
  @ApiOkResponse({ type: BoardArchiveResponseDto })
  @ApiNotFound(BOARD_NOT_FOUND)
  @Get(':id/archive')
  archive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.boards.archive(id, user.id);
  }

  @ApiOperation({ summary: 'Đánh dấu / bỏ đánh dấu sao', description: 'Trạng thái sao là riêng của từng user.' })
  @ApiParam({ name: 'id', description: 'ID bảng' })
  @ApiOkResponse({ type: StarResponseDto })
  @ApiValidationError(['starred phải là true hoặc false'])
  @ApiNotFound(BOARD_NOT_FOUND)
  @Put(':id/star')
  async setStarred(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: StarBoardDto) {
    return this.boards.setStarred(id, user.id, dto.starred);
  }
}
