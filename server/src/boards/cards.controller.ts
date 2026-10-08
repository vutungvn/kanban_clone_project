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
import { CARD_NOT_FOUND, CardsService } from './cards.service';
import { CardResponseDto, CreateCardDto, MoveCardDto, UpdateCardDto } from './dto/card.dto';
import { LIST_NOT_FOUND } from './lists.service';

const VIEWER_FORBIDDEN = 'Bạn chỉ có quyền xem bảng này';

@ApiTags('Cards')
@ApiAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @ApiOperation({ summary: 'Thêm thẻ', description: 'Thêm vào cuối danh sách. Cần vai trò MEMBER trở lên.' })
  @ApiParam({ name: 'listId', description: 'ID danh sách' })
  @ApiCreatedResponse({ type: CardResponseDto })
  @ApiValidationError(['Vui lòng nhập tiêu đề thẻ'])
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(LIST_NOT_FOUND)
  @Post('lists/:listId/cards')
  async create(@CurrentUser() user: AuthUser, @Param('listId') listId: string, @Body() dto: CreateCardDto) {
    return { card: await this.cards.create(listId, user.id, dto) };
  }

  @ApiOperation({ summary: 'Sửa thẻ', description: 'Đổi tiêu đề và/hoặc mô tả. Chỉ gửi trường cần đổi.' })
  @ApiParam({ name: 'id', description: 'ID thẻ' })
  @ApiOkResponse({ type: CardResponseDto })
  @ApiValidationError(['Tiêu đề thẻ tối đa 500 ký tự'])
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(CARD_NOT_FOUND)
  @Patch('cards/:id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCardDto) {
    return { card: await this.cards.update(id, user.id, dto) };
  }

  @ApiOperation({
    summary: 'Di chuyển thẻ (kéo thả)',
    description:
      'Chuyển thẻ tới vị trí `index` của danh sách `listId` — cùng danh sách (đổi thứ tự) hoặc danh sách khác ' +
      'trong cùng bảng. Server tự tính `position`.',
  })
  @ApiParam({ name: 'id', description: 'ID thẻ' })
  @ApiOkResponse({ type: CardResponseDto })
  @ApiValidationError(['index phải là số nguyên', 'Vui lòng chọn danh sách đích'])
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(CARD_NOT_FOUND, 'Thẻ không tồn tại, danh sách đích không thuộc cùng bảng, hoặc bạn không phải thành viên')
  @Patch('cards/:id/move')
  async move(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MoveCardDto) {
    return { card: await this.cards.move(id, user.id, dto) };
  }

  @ApiOperation({ summary: 'Xoá thẻ' })
  @ApiParam({ name: 'id', description: 'ID thẻ' })
  @ApiNoContentResponse({ description: 'Đã xoá' })
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(CARD_NOT_FOUND)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('cards/:id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.cards.remove(id, user.id);
  }
}
