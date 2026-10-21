import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
import { CANNOT_DELETE_COMMENT, COMMENT_NOT_FOUND, NOT_COMMENT_AUTHOR, ActivitiesService } from './activities.service';
import { CARD_NOT_FOUND } from './boards.constants';
import { ActivitiesResponseDto, ActivityResponseDto, CommentDto, ListActivitiesQueryDto } from './dto/activity.dto';

const VIEWER_FORBIDDEN = 'Bạn chỉ có quyền xem bảng này';

@ApiTags('Activities')
@ApiAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @ApiOperation({
    summary: 'Lịch sử hoạt động của thẻ',
    description:
      'Bình luận + các thao tác trên thẻ (tạo, đổi tên, chuyển danh sách, nhãn, thành viên, ngày, checklist), mới nhất trước. ' +
      'Phân trang: truyền `nextCursor` của trang trước vào `cursor`. Mọi thành viên của bảng đều xem được.',
  })
  @ApiParam({ name: 'cardId', description: 'ID thẻ' })
  @ApiOkResponse({ type: ActivitiesResponseDto })
  @ApiValidationError(['filter phải là một trong: all, comments', 'limit tối đa là 50'])
  @ApiNotFound(CARD_NOT_FOUND)
  @Get('cards/:cardId/activities')
  list(@CurrentUser() user: AuthUser, @Param('cardId') cardId: string, @Query() query: ListActivitiesQueryDto) {
    return this.activities.list(cardId, user.id, query);
  }

  @ApiOperation({ summary: 'Viết bình luận', description: 'Cần vai trò MEMBER trở lên.' })
  @ApiParam({ name: 'cardId', description: 'ID thẻ' })
  @ApiCreatedResponse({ type: ActivityResponseDto })
  @ApiValidationError(['Vui lòng nhập nội dung bình luận'])
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(CARD_NOT_FOUND)
  @Post('cards/:cardId/comments')
  async addComment(@CurrentUser() user: AuthUser, @Param('cardId') cardId: string, @Body() dto: CommentDto) {
    return { activity: await this.activities.addComment(cardId, user.id, dto.text) };
  }

  @ApiOperation({ summary: 'Sửa bình luận', description: 'Chỉ người viết (vẫn cần vai trò MEMBER trở lên). Ghi lại `editedAt`.' })
  @ApiParam({ name: 'id', description: 'ID bình luận' })
  @ApiOkResponse({ type: ActivityResponseDto })
  @ApiValidationError(['Vui lòng nhập nội dung bình luận'])
  @ApiForbidden(NOT_COMMENT_AUTHOR, 'Không phải người viết, hoặc chỉ có quyền xem')
  @ApiNotFound(COMMENT_NOT_FOUND)
  @Patch('comments/:id')
  async updateComment(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CommentDto) {
    return { activity: await this.activities.updateComment(id, user.id, dto.text) };
  }

  @ApiOperation({ summary: 'Xoá bình luận', description: 'Người viết (MEMBER trở lên) hoặc ADMIN của bảng.' })
  @ApiParam({ name: 'id', description: 'ID bình luận' })
  @ApiNoContentResponse({ description: 'Đã xoá' })
  @ApiForbidden(CANNOT_DELETE_COMMENT, 'Không phải người viết / ADMIN, hoặc chỉ có quyền xem')
  @ApiNotFound(COMMENT_NOT_FOUND)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('comments/:id')
  async removeComment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.activities.removeComment(id, user.id);
  }
}
