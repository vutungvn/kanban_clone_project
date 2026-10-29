import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiAuth, ApiForbidden, ApiNotFound, ApiValidationError } from '../common/swagger/api-responses';
import { CreateWorkspaceDto, UpdateWorkspaceDto, WorkspaceResponseDto, WorkspacesResponseDto } from './dto/workspace.dto';
import { WORKSPACE_ADMIN_ONLY, WORKSPACE_NOT_FOUND } from './workspace-access.service';
import { TOO_MANY_WORKSPACES, WorkspacesService } from './workspaces.service';

const NOT_FOUND_DESCRIPTION = 'Không tồn tại hoặc bạn không phải thành viên của không gian';

@ApiTags('Workspaces')
@ApiAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @ApiOperation({
    summary: 'Không gian của tôi',
    description: 'Mọi không gian mình là thành viên, kèm vai trò. Bảng của từng không gian lấy từ `GET /boards` (trường `workspace`).',
  })
  @ApiOkResponse({ type: WorkspacesResponseDto })
  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return { workspaces: await this.workspaces.list(user.id) };
  }

  @ApiOperation({ summary: 'Tạo không gian', description: `Người tạo là quản trị viên. Mỗi người tạo tối đa 10 không gian.` })
  @ApiCreatedResponse({ type: WorkspaceResponseDto })
  @ApiValidationError(['Vui lòng nhập tên không gian', TOO_MANY_WORKSPACES])
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkspaceDto) {
    return { workspace: await this.workspaces.create(user.id, dto) };
  }

  @ApiOperation({ summary: 'Chi tiết không gian' })
  @ApiParam({ name: 'id', description: 'ID không gian' })
  @ApiOkResponse({ type: WorkspaceResponseDto })
  @ApiNotFound(WORKSPACE_NOT_FOUND, NOT_FOUND_DESCRIPTION)
  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return { workspace: await this.workspaces.findOne(id, user.id) };
  }

  @ApiOperation({ summary: 'Sửa tên / mô tả không gian', description: 'Chỉ quản trị viên của không gian.' })
  @ApiParam({ name: 'id', description: 'ID không gian' })
  @ApiOkResponse({ type: WorkspaceResponseDto })
  @ApiValidationError(['Vui lòng nhập tên không gian'])
  @ApiForbidden(WORKSPACE_ADMIN_ONLY, 'Chỉ là thành viên, không phải quản trị viên')
  @ApiNotFound(WORKSPACE_NOT_FOUND, NOT_FOUND_DESCRIPTION)
  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateWorkspaceDto) {
    return { workspace: await this.workspaces.update(id, user.id, dto) };
  }
}
