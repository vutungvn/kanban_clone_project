'use client';

import { AlignLeft, Clock, MessageSquare, Paperclip, SquareCheck } from 'lucide-react';
import { createContext, useContext } from 'react';
import { Avatar } from '@/components/avatar';
import { cardCover } from '@/lib/attachments';
import type { BoardMember, Card, Label } from '@/lib/boards-api';
import { DUE_STATUS_CLASS, DUE_STATUS_LABEL, dueStatus, formatCardDates } from '@/lib/card-dates';
import { cn } from '@/lib/cn';
import { labelDisplayName } from '@/lib/labels';
import { checklistProgress } from './card-checklists';
import { LabelChip } from './card-ui';

/** Nhãn + thành viên của bảng — thẻ chỉ giữ id nên cần tra cứu khi hiển thị. */
const BoardLookupContext = createContext<{ labels: Label[]; members: BoardMember[] }>({ labels: [], members: [] });
export const BoardLookupProvider = BoardLookupContext.Provider;

/** Nhãn của thẻ theo thứ tự nhãn của bảng; thành viên theo thứ tự được giao. Bỏ qua id không còn tồn tại. */
export function resolveCard(card: Card, labels: Label[], members: BoardMember[]) {
  return {
    labels: labels.filter((l) => card.labelIds.includes(l.id)),
    members: card.memberIds.map((id) => members.find((m) => m.id === id)).filter((m): m is BoardMember => !!m),
  };
}

export function useResolvedCard(card: Card) {
  const { labels, members } = useContext(BoardLookupContext);
  return resolveCard(card, labels, members);
}

/** Mô tả ngắn cho trình đọc màn hình: nhãn, ngày, checklist, thành viên. */
export function describeCard(card: Card, labels: Label[], members: BoardMember[]) {
  const parts: string[] = [];
  if (labels.length) parts.push(`Nhãn: ${labels.map(labelDisplayName).join(', ')}`);
  const dates = formatCardDates(card);
  const status = dueStatus(card);
  if (dates) parts.push(`Ngày: ${dates}${status && DUE_STATUS_LABEL[status] ? ` (${DUE_STATUS_LABEL[status]})` : ''}`);
  const { done, total } = checklistProgress(card.checklists);
  if (total) parts.push(`Checklist ${done}/${total}`);
  if (card.commentCount) parts.push(`${card.commentCount} bình luận`);
  if (card.attachments.length) parts.push(`${card.attachments.length} tệp đính kèm`);
  if (members.length) parts.push(`Thành viên: ${members.map((m) => m.name).join(', ')}`);
  return parts.join('. ');
}

/** Ảnh bìa trên thẻ ngoài bảng — tràn sát mép thẻ (bù lại padding p-3 của thẻ). */
function CardFaceCover({ card }: { card: Card }) {
  const cover = cardCover(card);
  if (!cover) return null;
  if ('color' in cover) return <div aria-hidden className="-mx-3 -mt-3 mb-2 h-8 rounded-t-lg" style={{ backgroundColor: cover.color }} />;
  const { previewUrl, width, height } = cover.image;
  return (
    <div className="-mx-3 -mt-3 mb-2 overflow-hidden rounded-t-lg bg-surface-mid">
      <img
        src={previewUrl!}
        alt=""
        loading="lazy"
        // Không cho kéo ảnh kiểu HTML — để kéo thả thẻ hoạt động bình thường
        draggable={false}
        // Giữ chỗ đúng tỉ lệ trước khi ảnh tải xong → danh sách không bị nhảy
        style={width && height ? { aspectRatio: `${width} / ${height}` } : undefined}
        className="block max-h-64 w-full object-cover"
      />
    </div>
  );
}

/** Nội dung thẻ ngoài bảng: ảnh bìa, nhãn, tiêu đề, các badge, avatar thành viên. */
export function CardFace({ card }: { card: Card }) {
  const { labels, members } = useResolvedCard(card);
  const dates = formatCardDates(card);
  const status = dueStatus(card);
  const { done, total } = checklistProgress(card.checklists);
  const files = card.attachments.length;
  const hasBadges = !!dates || !!card.description || card.commentCount > 0 || files > 0 || total > 0 || members.length > 0;

  return (
    <>
      <CardFaceCover card={card} />
      {labels.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1 pr-6">
          {labels.map((l) => (
            <LabelChip key={l.id} label={l} size="xs" />
          ))}
        </div>
      )}
      <p className="pr-6 wrap-break-word whitespace-pre-wrap">{card.title}</p>
      {hasBadges && (
        <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-subtle">
          {dates && (
            <span
              title={status ? (DUE_STATUS_LABEL[status] ?? 'Hạn chót') : 'Ngày bắt đầu'}
              className={cn('flex h-6 items-center gap-1 rounded px-1.5', status && DUE_STATUS_CLASS[status])}
            >
              <Clock size={14} aria-hidden />
              {dates}
            </span>
          )}
          {card.description && (
            <span className="flex h-6 items-center px-1" title="Thẻ có mô tả">
              <AlignLeft size={16} aria-hidden />
            </span>
          )}
          {card.commentCount > 0 && (
            <span className="flex h-6 items-center gap-1 px-1" title="Bình luận">
              <MessageSquare size={14} aria-hidden />
              {card.commentCount}
            </span>
          )}
          {files > 0 && (
            <span className="flex h-6 items-center gap-1 px-1" title="Tệp đính kèm">
              <Paperclip size={14} aria-hidden />
              {files}
            </span>
          )}
          {total > 0 && (
            <span
              title="Việc cần làm"
              className={cn('flex h-6 items-center gap-1 rounded px-1.5', done === total && 'bg-success text-white')}
            >
              <SquareCheck size={14} aria-hidden />
              {done}/{total}
            </span>
          )}
          {members.length > 0 && (
            <span className="ml-auto flex -space-x-1.5">
              {members.slice(0, 4).map((m) => (
                <Avatar key={m.id} name={m.name} seed={m.id} size={24} className="ring-2 ring-white" />
              ))}
              {members.length > 4 && (
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-surface-high px-1 text-[10px] font-medium text-ink ring-2 ring-white">
                  +{members.length - 4}
                </span>
              )}
            </span>
          )}
        </div>
      )}
    </>
  );
}
