import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BOARD_NOT_FOUND } from '../boards/board-access.service';
import { BoardSummaryResponseDto } from '../boards/dto/board.dto';
import { ApiAuth, ApiForbidden, ApiNotFound, ApiValidationError } from '../common/swagger/api-responses';
import {
  CreateBoardFromTemplateDto,
  SaveTemplateDto,
  TemplateDetailResponseDto,
  TemplateResponseDto,
  TemplatesResponseDto,
  UpdateTemplateDto,
} from './dto/template.dto';
import { BUILTIN_READONLY, EMPTY_BOARD, TEMPLATE_NOT_FOUND, TemplatesService, TOO_MANY_TEMPLATES } from './templates.service';

const TEMPLATE_ID = { name: 'id', description: 'ID mẫu: slug của mẫu có sẵn (vd `scrum`) hoặc CUID của mẫu của tôi' };

@ApiTags('Templates')
@ApiAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @ApiOperation({ summary: 'Danh sách mẫu', description: 'Mẫu có sẵn (ai cũng thấy) + mẫu của tôi (chỉ mình thấy). Không kèm nội dung.' })
  @ApiOkResponse({ type: TemplatesResponseDto })
  @Get('templates')
  list(@CurrentUser() user: AuthUser) {
    return this.templates.list(user.id);
  }

  @ApiOperation({ summary: 'Chi tiết mẫu (xem trước)', description: 'Kèm nội dung: nhãn, danh sách, thẻ, checklist.' })
  @ApiParam(TEMPLATE_ID)
  @ApiOkResponse({ type: TemplateDetailResponseDto })
  @ApiNotFound(TEMPLATE_NOT_FOUND, 'Không tồn tại hoặc là mẫu của người khác')
  @Get('templates/:id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return { template: await this.templates.findOne(id, user.id) };
  }

  @ApiOperation({
    summary: 'Tạo bảng từ mẫu',
    description:
      'Người tạo là ADMIN duy nhất. Nhãn theo mẫu (mẫu không có nhãn → 6 nhãn màu mặc định). ' +
      'Thẻ không có người được giao / ngày, checklist chưa hoàn thành. `keepCards=false`: chỉ tạo danh sách + nhãn.',
  })
  @ApiParam(TEMPLATE_ID)
  @ApiCreatedResponse({ type: BoardSummaryResponseDto })
  @ApiValidationError(['Vui lòng nhập tiêu đề bảng'])
  @ApiNotFound(TEMPLATE_NOT_FOUND, 'Không tồn tại hoặc là mẫu của người khác')
  @Post('templates/:id/boards')
  async createBoard(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateBoardFromTemplateDto) {
    return { board: await this.templates.createBoard(id, user.id, dto) };
  }

  @ApiOperation({
    summary: 'Lưu bảng thành mẫu',
    description:
      'Cần vai trò MEMBER trở lên. Chụp danh sách / thẻ chưa lưu trữ, nhãn, mô tả, màu bìa, checklist (bỏ người được giao, ngày, ' +
      'bình luận, tệp đính kèm). Mẫu độc lập với bảng gốc. Tối đa 30 danh sách, 300 thẻ; mỗi người tối đa 50 mẫu.',
  })
  @ApiParam({ name: 'boardId', description: 'ID bảng' })
  @ApiCreatedResponse({ type: TemplateResponseDto })
  @ApiValidationError(['Vui lòng nhập tên mẫu', EMPTY_BOARD, TOO_MANY_TEMPLATES])
  @ApiForbidden('Bạn chỉ có quyền xem bảng này', 'VIEWER không lưu được bảng thành mẫu')
  @ApiNotFound(BOARD_NOT_FOUND)
  @Post('boards/:boardId/template')
  async save(@CurrentUser() user: AuthUser, @Param('boardId') boardId: string, @Body() dto: SaveTemplateDto) {
    return { template: await this.templates.saveFromBoard(boardId, user.id, dto) };
  }

  @ApiOperation({ summary: 'Sửa mẫu của tôi', description: 'Đổi tên, mô tả, phông nền mặc định. Nội dung mẫu không sửa được.' })
  @ApiParam(TEMPLATE_ID)
  @ApiOkResponse({ type: TemplateResponseDto })
  @ApiForbidden(BUILTIN_READONLY, 'Là mẫu có sẵn')
  @ApiNotFound(TEMPLATE_NOT_FOUND, 'Không tồn tại hoặc là mẫu của người khác')
  @Patch('templates/:id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return { template: await this.templates.update(id, user.id, dto) };
  }

  @ApiOperation({ summary: 'Xoá mẫu của tôi', description: 'Bảng đã tạo từ mẫu không bị ảnh hưởng.' })
  @ApiParam(TEMPLATE_ID)
  @ApiNoContentResponse({ description: 'Đã xoá' })
  @ApiForbidden(BUILTIN_READONLY, 'Là mẫu có sẵn')
  @ApiNotFound(TEMPLATE_NOT_FOUND, 'Không tồn tại hoặc là mẫu của người khác')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('templates/:id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.templates.remove(id, user.id);
  }
}
