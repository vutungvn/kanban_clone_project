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
import { LABEL_NOT_FOUND } from './cards.service';
import { CreateLabelDto, LabelResponseDto, UpdateLabelDto } from './dto/label.dto';
import { LabelsService } from './labels.service';

const VIEWER_FORBIDDEN = 'Bạn chỉ có quyền xem bảng này';

@ApiTags('Labels')
@ApiAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class LabelsController {
  constructor(private readonly labels: LabelsService) {}

  @ApiOperation({
    summary: 'Tạo nhãn',
    description: 'Nhãn dùng chung cho mọi thẻ trong bảng. Bảng mới có sẵn 6 nhãn không tên. Cần vai trò MEMBER trở lên.',
  })
  @ApiParam({ name: 'boardId', description: 'ID bảng' })
  @ApiCreatedResponse({ type: LabelResponseDto })
  @ApiValidationError(['Màu nhãn không hợp lệ', 'Tên nhãn tối đa 50 ký tự'])
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(BOARD_NOT_FOUND)
  @Post('boards/:boardId/labels')
  async create(@CurrentUser() user: AuthUser, @Param('boardId') boardId: string, @Body() dto: CreateLabelDto) {
    return { label: await this.labels.create(boardId, user.id, dto) };
  }

  @ApiOperation({ summary: 'Sửa nhãn', description: 'Đổi tên và/hoặc màu — áp dụng cho mọi thẻ đang gắn nhãn này.' })
  @ApiParam({ name: 'id', description: 'ID nhãn' })
  @ApiOkResponse({ type: LabelResponseDto })
  @ApiValidationError(['Màu nhãn không hợp lệ'])
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(LABEL_NOT_FOUND)
  @Patch('labels/:id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateLabelDto) {
    return { label: await this.labels.update(id, user.id, dto) };
  }

  @ApiOperation({ summary: 'Xoá nhãn', description: 'Xoá khỏi bảng và gỡ khỏi mọi thẻ đang gắn.' })
  @ApiParam({ name: 'id', description: 'ID nhãn' })
  @ApiNoContentResponse({ description: 'Đã xoá' })
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(LABEL_NOT_FOUND)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('labels/:id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.labels.remove(id, user.id);
  }
}
