import { Archive, CreditCard } from 'lucide-react';
import { Avatar } from '@/components/avatar';
import { formatFull, formatRelative } from '@/lib/card-dates';
import { cn } from '@/lib/cn';
import { highlight, type CardSearchResult, type CommentSearchResult } from '@/lib/search';

// Nội dung 1 dòng kết quả tìm kiếm — dùng chung cho dropdown trên header và trang /search.

/** Văn bản có phần khớp từ khoá in đậm (không phân biệt dấu). */
export function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlight(text, query).map((part, i) =>
        part.match ? (
          <mark key={i} className="bg-transparent font-semibold text-ink">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

function ArchivedBadge() {
  return (
    <span className="ml-1.5 inline-flex shrink-0 items-center gap-1 rounded bg-surface-mid px-1.5 py-px align-middle text-[10px] font-medium text-ink-subtle">
      <Archive size={10} aria-hidden />
      Đã lưu trữ
    </span>
  );
}

/** Thẻ: tiêu đề · bảng / danh sách · đoạn trích mô tả (nếu chỉ khớp trong mô tả). */
export function CardResultContent({ card, query, large }: { card: CardSearchResult; query: string; large?: boolean }) {
  return (
    <>
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 items-center justify-center rounded bg-surface-mid text-ink-subtle',
          large ? 'h-9 w-9' : 'mt-0.5 h-7 w-7',
        )}
      >
        <CreditCard size={large ? 18 : 15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-ink', large ? 'text-[15px]' : 'text-sm')}>
          <Highlighted text={card.title} query={query} />
        </span>
        <span className="flex items-center text-xs text-ink-subtle">
          <span className="truncate">
            {card.board.title} · {card.list.title}
          </span>
          {card.archived && <ArchivedBadge />}
        </span>
        {card.excerpt && (
          <span className={cn('mt-1 block text-xs text-ink-subtle', large ? 'line-clamp-3' : 'line-clamp-2')}>
            <Highlighted text={card.excerpt} query={query} />
          </span>
        )}
      </span>
    </>
  );
}

/** Bình luận: người viết · thẻ · đoạn trích · bảng, thời gian. */
export function CommentResultContent({ comment, query, large }: { comment: CommentSearchResult; query: string; large?: boolean }) {
  const size = large ? 36 : 28;
  return (
    <>
      {comment.author ? (
        <Avatar name={comment.author.name} seed={comment.author.id} src={comment.author.avatarUrl} size={size} className="mt-0.5 shrink-0" />
      ) : (
        <span aria-hidden className="mt-0.5 shrink-0 rounded-full bg-surface-high" style={{ width: size, height: size }} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-ink-subtle">
          <span className="font-medium text-ink">{comment.author?.name ?? 'Người dùng đã bị xoá'}</span> trong thẻ{' '}
          <span className="font-medium text-ink">{comment.card.title}</span>
        </span>
        <span className={cn('mt-0.5 block text-ink', large ? 'line-clamp-3 text-sm' : 'line-clamp-2 text-[13px]')}>
          <Highlighted text={comment.excerpt} query={query} />
        </span>
        <span className="mt-0.5 flex items-center text-xs text-ink-subtle">
          <span className="truncate">
            {comment.board.title} ·{' '}
            <time dateTime={comment.createdAt} title={formatFull(comment.createdAt)}>
              {formatRelative(comment.createdAt)}
            </time>
          </span>
          {comment.card.archived && <ArchivedBadge />}
        </span>
      </span>
    </>
  );
}
