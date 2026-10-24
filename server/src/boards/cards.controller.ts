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
import {
  ATTACHMENT_NOT_FOUND,
  CARD_NOT_FOUND,
  CardsService,
  COVER_NOT_IMAGE,
  COVER_REQUIRED,
  LABEL_NOT_FOUND,
  NO_DUE_DATE,
  NOT_BOARD_MEMBER,
  START_AFTER_DUE,
} from './cards.service';
import {
  CardResponseDto,
  CardWithListResponseDto,
  CopyCardDto,
  CreateCardDto,
  MoveCardDto,
  SetCoverDto,
  UpdateCardDto,
} from './dto/card.dto';
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

  @ApiOperation({
    summary: 'Sửa thẻ',
    description:
      'Đổi tiêu đề, mô tả, ngày bắt đầu, hạn chót, trạng thái hoàn thành. Chỉ gửi trường cần đổi; `null` = xoá ngày. ' +
      'Ngày bắt đầu phải trước hoặc bằng hạn chót (so cả với giá trị đang lưu). Xoá hạn chót thì `dueComplete` về false.',
  })
  @ApiParam({ name: 'id', description: 'ID thẻ' })
  @ApiOkResponse({ type: CardResponseDto })
  @ApiValidationError(['Tiêu đề thẻ tối đa 500 ký tự', 'Hạn chót không hợp lệ', START_AFTER_DUE, NO_DUE_DATE])
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

  @ApiOperation({
    summary: 'Chi tiết thẻ',
    description: 'Kể cả thẻ đã lưu trữ (không có trong dữ liệu bảng) — dùng khi mở thẻ qua link. Mọi vai trò.',
  })
  @ApiParam({ name: 'id', description: 'ID thẻ' })
  @ApiOkResponse({ type: CardWithListResponseDto })
  @ApiNotFound(CARD_NOT_FOUND)
  @Get('cards/:id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return { card: await this.cards.findOne(id, user.id) };
  }

  @ApiOperation({ summary: 'Lưu trữ thẻ', description: 'Ẩn khỏi bảng, giữ nguyên dữ liệu và vị trí. Đã lưu trữ rồi thì không làm gì.' })
  @ApiParam({ name: 'id', description: 'ID thẻ' })
  @ApiOkResponse({ type: CardWithListResponseDto })
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(CARD_NOT_FOUND)
  @HttpCode(HttpStatus.OK)
  @Post('cards/:id/archive')
  async archive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return { card: await this.cards.setArchived(id, user.id, true) };
  }

  @ApiOperation({ summary: 'Khôi phục thẻ', description: 'Đưa thẻ đã lưu trữ về đúng vị trí cũ trong danh sách.' })
  @ApiParam({ name: 'id', description: 'ID thẻ' })
  @ApiOkResponse({ type: CardWithListResponseDto })
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(CARD_NOT_FOUND)
  @HttpCode(HttpStatus.OK)
  @Post('cards/:id/restore')
  async restore(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return { card: await this.cards.setArchived(id, user.id, false) };
  }

  @ApiOperation({
    summary: 'Sao chép thẻ',
    description:
      'Tạo thẻ mới ở vị trí `index` của danh sách `listId` (cùng bảng). Mô tả và màu ảnh bìa luôn được giữ; ' +
      'nhãn / thành viên / checklist / ngày / tệp đính kèm tuỳ chọn (mặc định giữ hết); không sao chép bình luận.',
  })
  @ApiParam({ name: 'id', description: 'ID thẻ gốc' })
  @ApiCreatedResponse({ type: CardResponseDto })
  @ApiValidationError(['Vui lòng nhập tiêu đề thẻ', 'Vui lòng chọn danh sách đích'])
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(CARD_NOT_FOUND, 'Thẻ không tồn tại, danh sách đích không thuộc cùng bảng / đã lưu trữ, hoặc bạn không phải thành viên')
  @Post('cards/:id/copy')
  async copy(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CopyCardDto) {
    return { card: await this.cards.copy(id, user.id, dto) };
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

  @ApiOperation({
    summary: 'Đặt ảnh bìa',
    description: 'Gửi đúng 1 trong 2: `color` (màu) hoặc `attachmentId` (ảnh đính kèm của chính thẻ). Thay cho ảnh bìa cũ.',
  })
  @ApiParam({ name: 'id', description: 'ID thẻ' })
  @ApiNoContentResponse({ description: 'Đã đặt' })
  @ApiValidationError([COVER_REQUIRED, COVER_NOT_IMAGE, 'Màu ảnh bìa không hợp lệ'])
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(ATTACHMENT_NOT_FOUND, 'Thẻ / ảnh không tồn tại, ảnh thuộc thẻ khác, hoặc bạn không phải thành viên')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Put('cards/:id/cover')
  async setCover(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetCoverDto) {
    await this.cards.setCover(id, user.id, dto);
  }

  @ApiOperation({ summary: 'Gỡ ảnh bìa', description: 'Ảnh đính kèm vẫn được giữ.' })
  @ApiParam({ name: 'id', description: 'ID thẻ' })
  @ApiNoContentResponse({ description: 'Đã gỡ' })
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(CARD_NOT_FOUND)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('cards/:id/cover')
  async removeCover(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.cards.removeCover(id, user.id);
  }

  @ApiOperation({ summary: 'Gắn nhãn vào thẻ', description: 'Nhãn phải thuộc cùng bảng. Đã gắn rồi thì không làm gì.' })
  @ApiParam({ name: 'id', description: 'ID thẻ' })
  @ApiParam({ name: 'labelId', description: 'ID nhãn' })
  @ApiNoContentResponse({ description: 'Đã gắn' })
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(LABEL_NOT_FOUND, 'Thẻ / nhãn không tồn tại, nhãn thuộc bảng khác, hoặc bạn không phải thành viên')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Put('cards/:id/labels/:labelId')
  async addLabel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('labelId') labelId: string) {
    await this.cards.addLabel(id, user.id, labelId);
  }

  @ApiOperation({ summary: 'Gỡ nhãn khỏi thẻ', description: 'Chưa gắn thì không làm gì.' })
  @ApiParam({ name: 'id', description: 'ID thẻ' })
  @ApiParam({ name: 'labelId', description: 'ID nhãn' })
  @ApiNoContentResponse({ description: 'Đã gỡ' })
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(CARD_NOT_FOUND)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('cards/:id/labels/:labelId')
  async removeLabel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('labelId') labelId: string) {
    await this.cards.removeLabel(id, user.id, labelId);
  }

  @ApiOperation({
    summary: 'Giao thẻ cho thành viên',
    description: 'Người được giao phải là thành viên của bảng (mọi vai trò). Đã giao rồi thì không làm gì.',
  })
  @ApiParam({ name: 'id', description: 'ID thẻ' })
  @ApiParam({ name: 'userId', description: 'ID người được giao' })
  @ApiNoContentResponse({ description: 'Đã giao' })
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(NOT_BOARD_MEMBER, 'Thẻ không tồn tại, người được giao không ở trong bảng, hoặc bạn không phải thành viên')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Put('cards/:id/members/:userId')
  async addMember(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('userId') userId: string) {
    await this.cards.addMember(id, user.id, userId);
  }

  @ApiOperation({ summary: 'Bỏ giao thẻ', description: 'Chưa được giao thì không làm gì.' })
  @ApiParam({ name: 'id', description: 'ID thẻ' })
  @ApiParam({ name: 'userId', description: 'ID người được giao' })
  @ApiNoContentResponse({ description: 'Đã bỏ giao' })
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(CARD_NOT_FOUND)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('cards/:id/members/:userId')
  async removeMember(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('userId') userId: string) {
    await this.cards.removeMember(id, user.id, userId);
  }
}
