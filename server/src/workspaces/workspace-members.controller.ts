import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiConflictResponse, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { ApiAuth, ApiForbidden, ApiNotFound, ApiValidationError } from '../common/swagger/api-responses';
import {
  InviteWorkspaceMemberDto,
  RemoveWorkspaceMemberQueryDto,
  UpdateWorkspaceMemberDto,
  WorkspaceMemberResponseDto,
  WorkspaceMembersResponseDto,
} from './dto/workspace-member.dto';
import { WORKSPACE_ADMIN_ONLY, WORKSPACE_NOT_FOUND } from './workspace-access.service';
import {
  ALREADY_WORKSPACE_MEMBER,
  LAST_WORKSPACE_ADMIN,
  LAST_WORKSPACE_ADMIN_LEAVE,
  USER_NOT_FOUND,
  WORKSPACE_MEMBER_NOT_FOUND,
  WorkspaceMembersService,
} from './workspace-members.service';

const NOT_FOUND_DESCRIPTION = 'Không gian không tồn tại / bạn không phải thành viên';

@ApiTags('Workspace members')
@ApiAuth()
@UseGuards(JwtAuthGuard)
@ApiParam({ name: 'workspaceId', description: 'ID không gian' })
@Controller('workspaces/:workspaceId/members')
export class WorkspaceMembersController {
  constructor(private readonly members: WorkspaceMembersService) {}

  @ApiOperation({
    summary: 'Thành viên và khách của không gian',
    description: 'Khách = thành viên bảng của không gian nhưng không thuộc không gian; chỉ tính các bảng bạn cũng là thành viên.',
  })
  @ApiOkResponse({ type: WorkspaceMembersResponseDto })
  @ApiNotFound(WORKSPACE_NOT_FOUND, NOT_FOUND_DESCRIPTION)
  @Get()
  list(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string) {
    return this.members.list(workspaceId, user.id);
  }

  @ApiOperation({ summary: 'Mời thành viên', description: 'Chỉ quản trị viên. Theo email của tài khoản đã có; vào ngay với vai trò đã chọn.' })
  @ApiCreatedResponse({ type: WorkspaceMemberResponseDto })
  @ApiValidationError(['Email không hợp lệ'])
  @ApiForbidden(WORKSPACE_ADMIN_ONLY)
  @ApiNotFound(USER_NOT_FOUND, `${NOT_FOUND_DESCRIPTION}, hoặc không có tài khoản với email này`)
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Đã là thành viên', example: { statusCode: 409, message: ALREADY_WORKSPACE_MEMBER, error: 'Conflict' } })
  @Post()
  async invite(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Body() dto: InviteWorkspaceMemberDto) {
    return { member: await this.members.invite(workspaceId, user.id, dto) };
  }

  @ApiOperation({ summary: 'Đổi vai trò', description: 'Chỉ quản trị viên. Không gian luôn còn ít nhất 1 quản trị viên.' })
  @ApiParam({ name: 'userId', description: 'ID người dùng (thành viên của không gian)' })
  @ApiOkResponse({ type: WorkspaceMemberResponseDto })
  @ApiValidationError([LAST_WORKSPACE_ADMIN])
  @ApiForbidden(WORKSPACE_ADMIN_ONLY)
  @ApiNotFound(WORKSPACE_MEMBER_NOT_FOUND, NOT_FOUND_DESCRIPTION)
  @Patch(':userId')
  async updateRole(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateWorkspaceMemberDto,
  ) {
    return { member: await this.members.updateRole(workspaceId, user.id, userId, dto) };
  }

  @ApiOperation({
    summary: 'Xoá thành viên / rời không gian',
    description:
      'userId = chính mình → rời không gian (vẫn ở các bảng, thành khách). Xoá người khác: chỉ quản trị viên; ' +
      '`fromBoards=true` gỡ họ khỏi mọi bảng của không gian (họ là ADMIN duy nhất của bảng nào → bạn thành ADMIN bảng đó).',
  })
  @ApiParam({ name: 'userId', description: 'ID người dùng' })
  @ApiOkResponse({ schema: { type: 'object', properties: { removedFromBoards: { type: 'number', example: 2, description: 'Số bảng đã gỡ người đó ra' } } } })
  @ApiValidationError([LAST_WORKSPACE_ADMIN, LAST_WORKSPACE_ADMIN_LEAVE])
  @ApiForbidden(WORKSPACE_ADMIN_ONLY)
  @ApiNotFound(WORKSPACE_MEMBER_NOT_FOUND, NOT_FOUND_DESCRIPTION)
  @HttpCode(HttpStatus.OK)
  @Delete(':userId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Query() query: RemoveWorkspaceMemberQueryDto,
  ) {
    return this.members.remove(workspaceId, user.id, userId, query.fromBoards);
  }
}
