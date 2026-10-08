import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { ApiAuth, ApiForbidden, ApiNotFound, ApiValidationError } from '../common/swagger/api-responses';
import { BOARD_NOT_FOUND } from './board-access.service';
import { InviteMemberDto, MemberResponseDto, UpdateMemberDto } from './dto/member.dto';
import {
  ALREADY_MEMBER,
  LAST_ADMIN,
  LAST_ADMIN_LEAVE,
  MEMBER_NOT_FOUND,
  MembersService,
  USER_NOT_FOUND,
} from './members.service';

const ADMIN_ONLY = 'Chỉ quản trị viên của bảng mới được thực hiện thao tác này';

// Mời theo email trả lời khác nhau tuỳ email có tài khoản hay không → giới hạn để khó dò danh sách email
const INVITE_LIMIT = { default: { limit: 20, ttl: 60_000 } };

const lastAdminResponse = (message: string) =>
  ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Dữ liệu không hợp lệ, hoặc thao tác làm bảng không còn quản trị viên nào',
    example: { statusCode: 400, message, error: 'Bad Request' },
  });

@ApiTags('Members')
@ApiAuth()
@UseGuards(JwtAuthGuard)
@Controller('boards/:boardId/members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @ApiOperation({
    summary: 'Mời thành viên',
    description: 'Thêm người đã có tài khoản vào bảng theo email. Chỉ ADMIN. Giới hạn 20 request/phút/IP.',
  })
  @ApiParam({ name: 'boardId', description: 'ID bảng' })
  @ApiCreatedResponse({ type: MemberResponseDto })
  @ApiValidationError(['Email không hợp lệ'])
  @ApiForbidden(ADMIN_ONLY)
  @ApiNotFound(USER_NOT_FOUND, 'Bảng không tồn tại / bạn không phải thành viên, hoặc email chưa có tài khoản')
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Người này đã ở trong bảng (kể cả tự mời chính mình)',
    example: { statusCode: 409, message: ALREADY_MEMBER, error: 'Conflict' },
  })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto, description: 'Vượt quá 20 request/phút/IP' })
  @Throttle(INVITE_LIMIT)
  @Post()
  async invite(@CurrentUser() user: AuthUser, @Param('boardId') boardId: string, @Body() dto: InviteMemberDto) {
    return { member: await this.members.invite(boardId, user.id, dto) };
  }

  @ApiOperation({
    summary: 'Đổi vai trò thành viên',
    description: 'Chỉ ADMIN. ADMIN có thể tự hạ quyền nếu bảng còn ADMIN khác.',
  })
  @ApiParam({ name: 'boardId', description: 'ID bảng' })
  @ApiParam({ name: 'userId', description: 'ID người dùng (thành viên của bảng)' })
  @ApiOkResponse({ type: MemberResponseDto })
  @lastAdminResponse(LAST_ADMIN)
  @ApiForbidden(ADMIN_ONLY)
  @ApiNotFound(MEMBER_NOT_FOUND, 'Bảng không tồn tại / bạn không phải thành viên, hoặc người này không ở trong bảng')
  @Patch(':userId')
  async updateRole(
    @CurrentUser() user: AuthUser,
    @Param('boardId') boardId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return { member: await this.members.updateRole(boardId, user.id, userId, dto) };
  }

  @ApiOperation({
    summary: 'Xoá thành viên / rời bảng',
    description: '`userId` là chính mình = rời bảng (mọi vai trò). Xoá người khác: chỉ ADMIN. Không được để bảng hết ADMIN.',
  })
  @ApiParam({ name: 'boardId', description: 'ID bảng' })
  @ApiParam({ name: 'userId', description: 'ID người dùng cần xoá (hoặc chính mình)' })
  @ApiNoContentResponse({ description: 'Đã xoá khỏi bảng' })
  @lastAdminResponse(LAST_ADMIN_LEAVE)
  @ApiForbidden(ADMIN_ONLY)
  @ApiNotFound(BOARD_NOT_FOUND)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':userId')
  async remove(@CurrentUser() user: AuthUser, @Param('boardId') boardId: string, @Param('userId') userId: string) {
    await this.members.remove(boardId, user.id, userId);
  }
}
