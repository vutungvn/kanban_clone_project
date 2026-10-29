-- Tìm kiếm toàn cục (full-text search) trên thẻ (tiêu đề + mô tả) và bình luận.
-- Không phân biệt dấu: bỏ dấu bằng `unaccent` cả lúc tạo vector lẫn lúc tạo truy vấn (SearchService).
-- Config 'simple': không tách gốc từ / không có stopword — hợp với tiếng Việt.

CREATE EXTENSION IF NOT EXISTS unaccent;

-- Cột generated / index chỉ nhận hàm IMMUTABLE, mà unaccent(text) chỉ là STABLE (phụ thuộc search_path)
-- → bọc lại, chỉ rõ schema của từ điển để kết quả luôn như nhau.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- Thẻ: tiêu đề trọng số A (xếp trên), mô tả trọng số B. Postgres tự tính lại khi tiêu đề / mô tả đổi.
ALTER TABLE "cards" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', f_unaccent(coalesce("title", ''))), 'A') ||
  setweight(to_tsvector('simple', f_unaccent(coalesce("description", ''))), 'B')
) STORED;

-- Hoạt động: chỉ bình luận có `text` (hoạt động khác text = null → vector rỗng).
ALTER TABLE "activities" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
  to_tsvector('simple', f_unaccent(coalesce("text", '')))
) STORED;

-- CreateIndex
CREATE INDEX "cards_searchVector_idx" ON "cards" USING GIN ("searchVector");

-- CreateIndex
CREATE INDEX "activities_searchVector_idx" ON "activities" USING GIN ("searchVector");
