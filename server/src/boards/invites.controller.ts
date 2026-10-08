import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import {
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
import {
  ApproveJoinRequestDto,
  CreateInviteLinkDto,
  InviteLinkResponseDto,
  InvitePreviewResponseDto,
  JoinRequestsResponseDto,
  JoinResultDto,
  UpdateInviteLinkDto,
} from './dto/invite.dto';
import { MemberResponseDto } from './dto/member.dto';
import { INVITE_INVALID, InvitesService, LINK_DISABLED, REQUEST_NOT_FOUND } from './invites.service';
import { ALREADY_MEMBER } from './members.service';

const ADMIN_ONLY = 'Chỉ quản trị viên của bảng mới được thực hiện thao tác này';
const TOKEN_LIMIT = { default: { limit: 30, ttl: 60_000 } };

/** ADMIN quản lý liên kết mời và duyệt yêu cầu tham gia. */
@ApiTags('Invites')
@ApiAuth()
@UseGuards(JwtAuthGuard)
@Controller('boards/:boardId')
export class BoardInvitesController {
  constructor(private readonly invites: InvitesService) {}

  @ApiOperation({ summary: 'Xem liên kết mời', description: 'Chỉ ADMIN. `link: null` = đang tắt.' })
  @ApiParam({ name: 'boardId', description: 'ID bảng' })
  @ApiOkResponse({ type: InviteLinkResponseDto })
  @ApiForbidden(ADMIN_ONLY)
  @ApiNotFound(BOARD_NOT_FOUND)
  @Get('invite-link')
  async getLink(@CurrentUser() user: AuthUser, @Param('boardId') boardId: string) {
    return { link: await this.invites.getLink(boardId, user.id) };
  }

  @ApiOperation({
    summary: 'Tạo / tạo lại liên kết mời',
    description: 'Luôn sinh token mới — link cũ (nếu có) hết hiệu lực ngay. Chỉ ADMIN; link chỉ cấp MEMBER hoặc VIEWER.',
  })
  @ApiParam({ name: 'boardId', description: 'ID bảng' })
  @ApiOkResponse({ type: InviteLinkResponseDto })
  @ApiValidationError(['Liên kết chỉ cấp được vai trò MEMBER hoặc VIEWER'])
  @ApiForbidden(ADMIN_ONLY)
  @ApiNotFound(BOARD_NOT_FOUND)
  @Put('invite-link')
  async createLink(@CurrentUser() user: AuthUser, @Param('boardId') boardId: string, @Body() dto: CreateInviteLinkDto) {
    return { link: await this.invites.createLink(boardId, user.id, dto) };
  }

  @ApiOperation({ summary: 'Đổi cài đặt liên kết', description: 'Đổi vai trò / chế độ duyệt, giữ nguyên token. Chỉ ADMIN.' })
  @ApiParam({ name: 'boardId', description: 'ID bảng' })
  @ApiOkResponse({ type: InviteLinkResponseDto })
  @ApiValidationError(['Liên kết chỉ cấp được vai trò MEMBER hoặc VIEWER'])
  @ApiForbidden(ADMIN_ONLY)
  @ApiNotFound(LINK_DISABLED, 'Bảng không tồn tại / bạn không phải thành viên, hoặc liên kết đang tắt')
  @Patch('invite-link')
  async updateLink(@CurrentUser() user: AuthUser, @Param('boardId') boardId: string, @Body() dto: UpdateInviteLinkDto) {
    return { link: await this.invites.updateLink(boardId, user.id, dto) };
  }

  @ApiOperation({ summary: 'Tắt liên kết mời', description: 'Chỉ ADMIN. Yêu cầu tham gia đang chờ vẫn được giữ.' })
  @ApiParam({ name: 'boardId', description: 'ID bảng' })
  @ApiNoContentResponse({ description: 'Đã tắt' })
  @ApiForbidden(ADMIN_ONLY)
  @ApiNotFound(BOARD_NOT_FOUND)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('invite-link')
  async disableLink(@CurrentUser() user: AuthUser, @Param('boardId') boardId: string) {
    await this.invites.disableLink(boardId, user.id);
  }

  @ApiOperation({ summary: 'Danh sách yêu cầu tham gia', description: 'Chỉ ADMIN. Cũ nhất trước.' })
  @ApiParam({ name: 'boardId', description: 'ID bảng' })
  @ApiOkResponse({ type: JoinRequestsResponseDto })
  @ApiForbidden(ADMIN_ONLY)
  @ApiNotFound(BOARD_NOT_FOUND)
  @Get('join-requests')
  async listRequests(@CurrentUser() user: AuthUser, @Param('boardId') boardId: string) {
    return { requests: await this.invites.listRequests(boardId, user.id) };
  }

  @ApiOperation({ summary: 'Duyệt yêu cầu tham gia', description: 'Chỉ ADMIN; được chọn mọi vai trò.' })
  @ApiParam({ name: 'boardId', description: 'ID bảng' })
  @ApiParam({ name: 'userId', description: 'ID người gửi yêu cầu' })
  @ApiCreatedResponse({ type: MemberResponseDto })
  @ApiValidationError(['Vai trò phải là một trong: ADMIN, MEMBER, VIEWER'])
  @ApiForbidden(ADMIN_ONLY)
  @ApiNotFound(REQUEST_NOT_FOUND, 'Bảng không tồn tại / bạn không phải thành viên, hoặc yêu cầu đã được xử lý')
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Người này đã vào bảng bằng cách khác — yêu cầu đã được dọn',
    example: { statusCode: 409, message: ALREADY_MEMBER, error: 'Conflict' },
  })
  @Post('join-requests/:userId/approve')
  async approve(
    @CurrentUser() user: AuthUser,
    @Param('boardId') boardId: string,
    @Param('userId') userId: string,
    @Body() dto: ApproveJoinRequestDto,
  ) {
    return { member: await this.invites.approve(boardId, user.id, userId, dto) };
  }

  @ApiOperation({ summary: 'Từ chối yêu cầu tham gia', description: 'Chỉ ADMIN. Người bị từ chối có thể gửi lại.' })
  @ApiParam({ name: 'boardId', description: 'ID bảng' })
  @ApiParam({ name: 'userId', description: 'ID người gửi yêu cầu' })
  @ApiNoContentResponse({ description: 'Đã từ chối' })
  @ApiForbidden(ADMIN_ONLY)
  @ApiNotFound(REQUEST_NOT_FOUND)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('join-requests/:userId')
  async reject(@CurrentUser() user: AuthUser, @Param('boardId') boardId: string, @Param('userId') userId: string) {
    await this.invites.reject(boardId, user.id, userId);
  }
}

/** Người nhận mở liên kết mời. Cần đăng nhập; giới hạn 30 request/phút/IP. */
@ApiTags('Invites')
@ApiAuth()
@UseGuards(JwtAuthGuard)
@ApiTooManyRequestsResponse({ type: ErrorResponseDto, description: 'Vượt quá 30 request/phút/IP' })
@Throttle(TOKEN_LIMIT)
@Controller('invites/:token')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @ApiOperation({
    summary: 'Xem trước lời mời',
    description: 'Tên, phông nền, số thành viên của bảng + trạng thái của bạn. Không trả nội dung bảng.',
  })
  @ApiParam({ name: 'token', description: 'Token trong liên kết /invite/{token}' })
  @ApiOkResponse({ type: InvitePreviewResponseDto })
  @ApiNotFound(INVITE_INVALID, 'Token sai, liên kết đã bị tắt / tạo lại, hoặc bảng đã bị xoá')
  @Get()
  async preview(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return { invite: await this.invites.preview(token, user.id) };
  }

  @ApiOperation({
    summary: 'Tham gia / gửi yêu cầu',
    description:
      'Link không cần duyệt → thành thành viên (`MEMBER`). Cần duyệt → tạo yêu cầu (`PENDING`). ' +
      'Đã là thành viên → trả `MEMBER`, vai trò giữ nguyên. Gọi lại nhiều lần vẫn an toàn.',
  })
  @ApiParam({ name: 'token', description: 'Token trong liên kết' })
  @ApiOkResponse({ type: JoinResultDto })
  @ApiNotFound(INVITE_INVALID, 'Token sai, liên kết đã bị tắt / tạo lại, hoặc bảng đã bị xoá')
  @HttpCode(HttpStatus.OK)
  @Post('join')
  join(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.invites.join(token, user.id);
  }

  @ApiOperation({ summary: 'Huỷ yêu cầu tham gia của tôi' })
  @ApiParam({ name: 'token', description: 'Token trong liên kết' })
  @ApiNoContentResponse({ description: 'Đã huỷ (hoặc không có yêu cầu nào)' })
  @ApiNotFound(INVITE_INVALID)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('request')
  async cancelRequest(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    await this.invites.cancelRequest(token, user.id);
  }
}
