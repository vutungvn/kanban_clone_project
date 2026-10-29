'use client';

import { Check, CircleCheck, LoaderCircle, X } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Modal, ModalCloseButton } from '@/components/modal';
import { Alert } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import type { BoardDetail } from '@/lib/boards-api';
import { templatesApi, type TemplateSummary } from '@/lib/templates-api';

const MAX_TITLE = 100;
const MAX_DESCRIPTION = 500;

const KEPT = ['Danh sách và thứ tự', 'Nhãn của bảng', 'Thẻ: tiêu đề, mô tả, nhãn, màu bìa', 'Checklist (đặt lại về chưa hoàn thành)'];
const DROPPED = ['Danh sách / thẻ đã lưu trữ', 'Người được giao, thành viên bảng', 'Ngày bắt đầu, hạn chót', 'Bình luận, lịch sử, tệp đính kèm'];

/**
 * Lưu bảng thành "Mẫu của tôi" (menu ⋯ của bảng; ADMIN, MEMBER). Mẫu là bản chụp tại lúc lưu —
 * sửa / xoá bảng sau đó không ảnh hưởng mẫu. Lưu xong hiện link sang trang Mẫu.
 */
export function SaveTemplateModal({ board, onClose }: { board: BoardDetail; onClose: () => void }) {
  const [title, setTitle] = useState(board.title);
  const [description, setDescription] = useState('');
  const [keepCards, setKeepCards] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<TemplateSummary | null>(null);
  const trimmed = title.trim();
  const cardCount = board.lists.reduce((n, list) => n + list.cards.length, 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed || pending) return;
    setPending(true);
    setError(null);
    try {
      setSaved(await templatesApi.saveFromBoard(board.id, { title: trimmed, description: description.trim(), keepCards }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal label="Lưu thành mẫu" onClose={onClose} className="max-w-lg">
      <ModalCloseButton onClick={onClose} />
      {saved ? (
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <CircleCheck size={40} className="text-success" />
          <h2 className="text-lg font-semibold text-ink">Đã lưu mẫu &quot;{saved.title}&quot;</h2>
          <p className="text-sm text-ink-subtle">
            {saved.lists.length} danh sách · {saved.cardCount} thẻ. Mẫu nằm trong mục <strong className="text-ink">Mẫu của tôi</strong>, chỉ
            bạn thấy.
          </p>
          <div className="mt-2 flex gap-2">
            <Link
              href="/templates"
              className="inline-flex h-9 items-center rounded bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
            >
              Xem trang Mẫu
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded bg-surface-mid px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-high"
            >
              Đóng
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4 p-5 sm:p-6">
          <header className="pr-8">
            <h2 className="text-lg font-semibold text-ink">Lưu bảng thành mẫu</h2>
            <p className="mt-1 text-sm text-ink-subtle">Dùng lại cấu trúc của bảng này để tạo bảng mới. Chỉ bạn thấy mẫu này.</p>
          </header>

          <div>
            <label htmlFor="template-title" className="mb-1.5 flex justify-between text-xs font-semibold">
              <span>
                Tên mẫu <span className="text-danger">*</span>
              </span>
              <span className="font-medium text-ink-subtle">
                {title.length}/{MAX_TITLE}
              </span>
            </label>
            <input
              id="template-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={MAX_TITLE}
              className="h-9 w-full rounded bg-card px-3 text-sm text-ink shadow-[0_0_0_1px_var(--color-hairline)] outline-none focus:shadow-[0_0_0_2px_var(--color-brand)]"
            />
          </div>

          <div>
            <label htmlFor="template-description" className="mb-1.5 flex justify-between text-xs font-semibold">
              <span>Mô tả</span>
              <span className="font-medium text-ink-subtle">
                {description.length}/{MAX_DESCRIPTION}
              </span>
            </label>
            <textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={MAX_DESCRIPTION}
              rows={2}
              placeholder="Mẫu này dùng để làm gì?"
              className="w-full resize-none rounded bg-card px-3 py-2 text-sm text-ink shadow-[0_0_0_1px_var(--color-hairline)] outline-none placeholder:text-outline focus:shadow-[0_0_0_2px_var(--color-brand)]"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-2 text-sm text-ink">
            <input type="checkbox" checked={keepCards} onChange={(e) => setKeepCards(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
            <span>
              Gồm cả thẻ ({cardCount} thẻ)
              <span className="block text-xs text-ink-subtle">Bỏ chọn: chỉ lưu khung gồm danh sách và nhãn.</span>
            </span>
          </label>

          <div className="grid gap-3 rounded-lg bg-surface-low p-3 text-xs sm:grid-cols-2">
            <SummaryList title="Được giữ" items={keepCards ? KEPT : KEPT.slice(0, 2)} kept />
            <SummaryList title="Không giữ" items={keepCards ? DROPPED : ['Toàn bộ thẻ', 'Danh sách đã lưu trữ']} />
          </div>

          {error && <Alert tone="error">{error}</Alert>}

          <button
            type="submit"
            disabled={!trimmed || pending}
            className="flex h-9 items-center justify-center gap-2 rounded bg-brand text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-surface-mid disabled:text-outline"
          >
            {pending && <LoaderCircle size={16} className="animate-spin" />}
            {pending ? 'Đang lưu...' : 'Lưu mẫu'}
          </button>
        </form>
      )}
    </Modal>
  );
}

function SummaryList({ title, items, kept }: { title: string; items: string[]; kept?: boolean }) {
  const Icon = kept ? Check : X;
  return (
    <div>
      <p className="mb-1 font-semibold text-ink">{title}</p>
      <ul className="flex flex-col gap-0.5 text-ink-subtle">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-1.5">
            <Icon size={13} className={kept ? 'mt-px shrink-0 text-success' : 'mt-px shrink-0 text-danger'} aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
