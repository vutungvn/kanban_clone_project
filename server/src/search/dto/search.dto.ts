import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { queryBoolean, trimString } from '../../common/transforms';
import { MyBoardRefDto } from '../../boards/dto/me.dto';

export const SEARCH_TYPES = ['all', 'cards', 'comments'] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export const MIN_QUERY = 2;
export const MAX_QUERY = 100;

// ===== Request =====

export class SearchQueryDto {
  @ApiProperty({
    minLength: MIN_QUERY,
    maxLength: MAX_QUERY,
    example: 'thiet ke',
    description: 'Từ khoá — không phân biệt dấu / hoa thường; mọi từ đều phải có, mỗi từ khớp đầu từ ("thiet k" khớp "Thiết kế")',
  })
  @Transform(trimString)
  @IsString()
  @MinLength(MIN_QUERY, { message: `Từ khoá tối thiểu ${MIN_QUERY} ký tự` })
  @MaxLength(MAX_QUERY, { message: `Từ khoá tối đa ${MAX_QUERY} ký tự` })
  q: string;

  @ApiPropertyOptional({ enum: SEARCH_TYPES, default: 'all', description: '`all`: cả thẻ và bình luận' })
  @IsOptional()
  @IsIn(SEARCH_TYPES, { message: `type phải là một trong: ${SEARCH_TYPES.join(', ')}` })
  type: SearchType = 'all';

  @ApiPropertyOptional({ description: 'Chỉ tìm trong 1 bảng (phải là thành viên, không thì không có kết quả)' })
  @IsOptional()
  @IsString()
  boardId?: string;

  @ApiPropertyOptional({ default: false, description: 'Gồm cả thẻ đã lưu trữ (hoặc nằm trong danh sách đã lưu trữ) và bình luận của chúng' })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean({ message: 'archived phải là true hoặc false' })
  archived: boolean = false;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 10, description: 'Số kết quả mỗi nhóm' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit phải là số nguyên' })
  @Min(1, { message: 'limit tối thiểu là 1' })
  @Max(50, { message: 'limit tối đa là 50' })
  limit: number = 10;

  @ApiPropertyOptional({ minimum: 0, maximum: 1000, default: 0, description: 'Bỏ qua ngần này kết quả đầu (trang sau = offset + limit)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'offset phải là số nguyên' })
  @Min(0, { message: 'offset tối thiểu là 0' })
  @Max(1000, { message: 'offset tối đa là 1000' })
  offset: number = 0;
}

// ===== Response =====

class SearchListRefDto {
  @ApiProperty({ example: 'cmglist00000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'Đang làm' })
  title: string;
}

export class CardSearchResultDto {
  @ApiProperty({ example: 'cmgcard00000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'Thiết kế trang chủ' })
  title: string;

  @ApiProperty({ enum: ['title', 'description'], description: '`title`: mọi từ khoá đều có trong tiêu đề (xếp trên); `description`: có từ khoá chỉ nằm trong mô tả' })
  matchedIn: 'title' | 'description';

  @ApiProperty({ type: String, nullable: true, example: '…cần thiết kế lại form đăng nhập cho…', description: 'Đoạn trích mô tả quanh chỗ khớp (chỉ khi matchedIn = description)' })
  excerpt: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  dueDate: Date | null;

  @ApiProperty({ example: false })
  dueComplete: boolean;

  @ApiProperty({ example: false, description: 'Thẻ hoặc danh sách chứa thẻ đã lưu trữ' })
  archived: boolean;

  @ApiProperty({ type: SearchListRefDto })
  list: SearchListRefDto;

  @ApiProperty({ type: MyBoardRefDto })
  board: MyBoardRefDto;
}

class SearchAuthorDto {
  @ApiProperty({ example: 'cmg9x2k7a0000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'Nguyễn Văn An' })
  name: string;

  @ApiProperty({ type: String, nullable: true, format: 'uri', example: null })
  avatarUrl: string | null;
}

class SearchCardRefDto {
  @ApiProperty({ example: 'cmgcard00000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'Thiết kế trang chủ' })
  title: string;

  @ApiProperty({ example: false, description: 'Thẻ hoặc danh sách chứa thẻ đã lưu trữ' })
  archived: boolean;
}

export class CommentSearchResultDto {
  @ApiProperty({ example: 'cmgact000000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'Mình đã thiết kế xong bản nháp, mọi người xem giúp nhé', description: 'Đoạn trích quanh chỗ khớp' })
  excerpt: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: SearchAuthorDto, nullable: true, description: 'null nếu tài khoản đã bị xoá' })
  author: SearchAuthorDto | null;

  @ApiProperty({ type: SearchCardRefDto })
  card: SearchCardRefDto;

  @ApiProperty({ type: MyBoardRefDto })
  board: MyBoardRefDto;
}

export class CardSearchGroupDto {
  @ApiProperty({ type: [CardSearchResultDto], description: 'Khớp ở tiêu đề trước, rồi theo mức độ khớp, rồi thẻ mới cập nhật' })
  items: CardSearchResultDto[];

  @ApiProperty({ example: 12, description: 'Tổng số kết quả (mọi trang)' })
  total: number;
}

export class CommentSearchGroupDto {
  @ApiProperty({ type: [CommentSearchResultDto], description: 'Theo mức độ khớp, rồi bình luận mới hơn' })
  items: CommentSearchResultDto[];

  @ApiProperty({ example: 3, description: 'Tổng số kết quả (mọi trang)' })
  total: number;
}

export class SearchResponseDto {
  @ApiPropertyOptional({ type: CardSearchGroupDto, description: 'Có khi type = all / cards' })
  cards?: CardSearchGroupDto;

  @ApiPropertyOptional({ type: CommentSearchGroupDto, description: 'Có khi type = all / comments' })
  comments?: CommentSearchGroupDto;
}
