import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiAuth, ApiValidationError } from '../common/swagger/api-responses';
import { FeedResponseDto, ListMyActivitiesQueryDto, MyCardsResponseDto } from './dto/me.dto';
import { MeService } from './me.service';

@ApiTags('Me')
@ApiAuth()
@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @ApiOperation({
    summary: 'Thẻ được giao cho tôi',
    description:
      'Gom từ mọi bảng mình đang là thành viên; bỏ thẻ / danh sách đã lưu trữ. Giao gần đây trước, tối đa 500 thẻ. ' +
      'Client tự nhóm theo hạn chót (theo giờ trên máy).',
  })
  @ApiOkResponse({ type: MyCardsResponseDto })
  @Get('cards')
  async cards(@CurrentUser() user: AuthUser) {
    return { cards: await this.me.cards(user.id) };
  }

  @ApiOperation({
    summary: 'Hoạt động trên các bảng tôi tham gia',
    description:
      'Lịch sử thẻ + bình luận trên mọi bảng mình đang là thành viên (rời bảng thì không còn thấy), mới nhất trước. ' +
      '`scope=mine`: chỉ việc mình đã làm. Phân trang: truyền `nextCursor` của trang trước vào `cursor`.',
  })
  @ApiOkResponse({ type: FeedResponseDto })
  @ApiValidationError(['scope phải là một trong: all, mine', 'limit tối đa là 50'])
  @Get('activities')
  activities(@CurrentUser() user: AuthUser, @Query() query: ListMyActivitiesQueryDto) {
    return this.me.activities(user.id, query);
  }
}
