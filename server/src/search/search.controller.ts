import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiAuth, ApiValidationError } from '../common/swagger/api-responses';
import { MIN_QUERY, SearchQueryDto, SearchResponseDto } from './dto/search.dto';
import { SearchService } from './search.service';

@ApiTags('Search')
@ApiAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @ApiOperation({
    summary: 'Tìm thẻ và bình luận trên mọi bảng',
    description:
      'Full-text search (Postgres) trên tiêu đề + mô tả thẻ và nội dung bình luận, chỉ trong các bảng mình đang là thành viên. ' +
      'Không phân biệt dấu / hoa thường; mọi từ đều phải có; mỗi từ khớp đầu từ (không khớp giữa từ). ' +
      'Mặc định bỏ thẻ đã lưu trữ (`archived=true` để gồm cả). Tìm bảng theo tên thì client tự lọc.',
  })
  @ApiOkResponse({ type: SearchResponseDto })
  @ApiValidationError([`Từ khoá tối thiểu ${MIN_QUERY} ký tự`, 'type phải là một trong: all, cards, comments'])
  @Get()
  run(@CurrentUser() user: AuthUser, @Query() query: SearchQueryDto) {
    return this.search.search(user.id, query);
  }
}
