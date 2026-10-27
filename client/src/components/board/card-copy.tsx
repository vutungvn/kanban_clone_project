'use client';

import { useRef, useState, type FormEvent } from 'react';
import { PopoverHeader } from '@/components/popover';
import { errorMessage } from '@/lib/api';
import type { BoardDetail, Card, CopyCardInput } from '@/lib/boards-api';
import { cn } from '@/lib/cn';
import { POPOVER_SECTION, PRIMARY_BUTTON, useAutosize } from './card-ui';
import { BoardSelect, SELECT_CLASS, useTargetBoards, useTargetLists, type TargetBoard } from './move-target';

const MAX_TITLE = 500;

/**
 * Popover "Sao chép thẻ": tên mới, phần muốn giữ (chỉ hiện phần thẻ đang có), danh sách + vị trí đích.
 * Mặc định: cùng danh sách, ngay dưới thẻ gốc. Mô tả luôn được giữ; bình luận thì không.
 */
export function CopyCardContent({
  board,
  card,
  onCopy,
  onClose,
}: {
  board: BoardDetail;
  card: Card;
  onCopy: (input: CopyCardInput, target: TargetBoard) => Promise<unknown>;
  onClose: () => void;
}) {
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(card.title);
  const [keep, setKeep] = useState({
    keepLabels: true,
    keepMembers: true,
    keepChecklists: true,
    keepDates: true,
    keepAttachments: true,
  });
  const boards = useTargetBoards(board);
  const [boardId, setBoardId] = useState(board.id);
  const target = useTargetLists(boardId, board);
  const currentIndex = board.lists.find((l) => l.id === card.listId)?.cards.findIndex((c) => c.id === card.id) ?? -1;
  const [listId, setListId] = useState(card.listId);
  // -1 = cuối danh sách
  const [index, setIndex] = useState(currentIndex + 1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useAutosize(titleRef, title);

  const lists = target.lists ?? [];
  const effectiveListId = lists.some((l) => l.id === listId) ? listId : (lists[0]?.id ?? '');
  const cardCount = (id: string) => lists.find((l) => l.id === id)?.cardCount ?? 0;
  const effectiveIndex = index < 0 ? cardCount(effectiveListId) : Math.min(index, cardCount(effectiveListId));
  const targetBoard = boards.find((b) => b.id === boardId) ?? { id: board.id, title: board.title };
  const checklistItems = card.checklists.reduce((n, c) => n + c.items.length, 0);
  const options = [
    { key: 'keepLabels', label: 'Nhãn', count: card.labelIds.length },
    { key: 'keepMembers', label: 'Thành viên', count: card.memberIds.length },
    { key: 'keepChecklists', label: 'Việc cần làm', count: checklistItems || card.checklists.length },
    { key: 'keepDates', label: 'Ngày', count: card.startDate || card.dueDate ? 1 : 0 },
    { key: 'keepAttachments', label: 'Tệp đính kèm', count: card.attachments.length },
  ] as const;
  const shown = options.filter((o) => o.count > 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = title.trim();
    if (!value) return setError('Vui lòng nhập tiêu đề thẻ');
    if (!effectiveListId) return setError('Vui lòng chọn danh sách đích');
    setPending(true);
    setError(null);
    try {
      await onCopy({ title: value, listId: effectiveListId, index: effectiveIndex, ...keep }, targetBoard);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <>
      <PopoverHeader title="Sao chép thẻ" onClose={onClose} />
      <form noValidate onSubmit={submit} className="flex flex-col">
        <label className="text-xs font-semibold text-ink-subtle" htmlFor="copy-card-title">
          Tiêu đề
        </label>
        <textarea
          id="copy-card-title"
          ref={titleRef}
          autoFocus
          rows={2}
          value={title}
          maxLength={MAX_TITLE}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          className="mt-1 w-full resize-none overflow-hidden rounded bg-card px-2.5 py-2 text-sm text-ink shadow-[0_0_0_1px_var(--color-hairline)] outline-none focus:shadow-[0_0_0_2px_var(--color-brand)]"
        />

        {shown.length > 0 && (
          <fieldset>
            <legend className={POPOVER_SECTION}>Giữ lại...</legend>
            <div className="flex flex-col gap-1">
              {shown.map((o) => (
                <label key={o.key} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-surface-low">
                  <input
                    type="checkbox"
                    checked={keep[o.key]}
                    onChange={(e) => setKeep((k) => ({ ...k, [o.key]: e.target.checked }))}
                    className="h-4 w-4 accent-brand"
                  />
                  {o.label}
                  {o.key !== 'keepDates' && <span className="text-xs text-ink-subtle">({o.count})</span>}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <h3 className={POPOVER_SECTION}>Sao chép tới...</h3>
        <div className="mb-2">
          <BoardSelect
            boards={boards}
            value={boardId}
            currentId={board.id}
            onChange={(next) => {
              setBoardId(next);
              // Bảng hiện tại → ngay dưới thẻ gốc; bảng khác → danh sách đầu, cuối danh sách
              setListId(next === board.id ? card.listId : '');
              setIndex(next === board.id ? currentIndex + 1 : -1);
            }}
          />
        </div>
        <div className="grid grid-cols-[1fr_88px] gap-2">
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-subtle">
            Danh sách
            <select
              value={effectiveListId}
              disabled={target.loading || !lists.length}
              onChange={(e) => {
                const next = e.target.value;
                setListId(next);
                // Cùng danh sách → ngay dưới thẻ gốc; danh sách khác → cuối
                setIndex(next === card.listId ? currentIndex + 1 : -1);
              }}
              className={SELECT_CLASS}
            >
              {target.loading && <option value="">Đang tải...</option>}
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                  {l.id === card.listId ? ' (hiện tại)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-subtle">
            Vị trí
            <select
              value={effectiveIndex}
              disabled={target.loading || !lists.length}
              onChange={(e) => setIndex(Number(e.target.value))}
              className={SELECT_CLASS}
            >
              {Array.from({ length: cardCount(effectiveListId) + 1 }, (_, i) => (
                <option key={i} value={i}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
        </div>

        {target.error && <p className="mt-2 text-xs font-medium text-danger">{target.error}</p>}
        {!target.loading && !target.error && !lists.length && (
          <p className="mt-2 text-xs text-ink-subtle">Bảng này chưa có danh sách nào.</p>
        )}
        {boardId !== board.id && (
          <p className="mt-2 text-xs text-ink-subtle">
            Nhãn được ghép theo tên + màu ở bảng đích; người được giao không thuộc bảng đích sẽ không được giữ.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-xs font-medium text-danger">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} className={cn(PRIMARY_BUTTON, 'mt-3 h-9 w-full')}>
          {pending ? 'Đang tạo...' : 'Tạo thẻ'}
        </button>
      </form>
    </>
  );
}
