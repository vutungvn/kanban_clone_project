import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

/** Tìm kiếm toàn cục: thẻ + bình luận (full-text search của Postgres). */
@Module({
  imports: [AuthModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
