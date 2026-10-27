'use client';

import { Plus, X } from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';
import { toast } from '@/components/toast';
import { errorMessage } from '@/lib/api';
import { useOutsideClick } from '@/lib/use-outside-click';

const PRIMARY_BUTTON =
  'h-8 rounded bg-brand px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover';
const CLOSE_BUTTON =
  'flex h-8 w-8 items-center justify-center rounded text-ink-subtle transition-colors hover:bg-black/10 hover:text-ink';

/**
 * Logic chung: gửi xong thì xoá ô nhập và giữ composer mở để nhập tiếp (giống Trello).
 * Lỗi thì trả lại chữ đã gõ + toast.
 */
function useComposer(onAdd: (title: string) => Promise<void>, onAdded?: () => void) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  async function submit() {
    const title = value.trim();
    inputRef.current?.focus();
    if (!title) return;
    setValue('');
    try {
      await onAdd(title);
      onAdded?.();
    } catch (e) {
      setValue(title);
      toast.error(errorMessage(e));
    }
  }

  function onKeyDown(e: KeyboardEvent, close: () => void) {
    // isComposing: đang gõ dở bằng bộ gõ (IME) thì Enter không phải là "gửi"
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    } else if (e.key === 'Escape') {
      close();
    }
  }

  return { value, setValue, inputRef, submit, onKeyDown };
}

export function AddCardComposer({
  onAdd,
  onClose,
  onAdded,
}: {
  onAdd: (title: string) => Promise<void>;
  onClose: () => void;
  onAdded?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { value, setValue, inputRef, submit, onKeyDown } = useComposer(onAdd, onAdded);
  useOutsideClick(ref, onClose);

  return (
    <div ref={ref} className="mt-2 flex flex-col gap-2">
      <textarea
        ref={inputRef}
        autoFocus
        rows={3}
        value={value}
        maxLength={500}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => onKeyDown(e, onClose)}
        placeholder="Nhập tiêu đề cho thẻ này..."
        aria-label="Tiêu đề thẻ mới"
        className="w-full resize-none rounded-lg bg-card p-2.5 text-sm text-ink shadow-sm ring-2 ring-brand outline-none placeholder:text-outline"
      />
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => void submit()} className={PRIMARY_BUTTON}>
          Thêm thẻ
        </button>
        <button type="button" onClick={onClose} aria-label="Huỷ" className={CLOSE_BUTTON}>
          <X size={20} />
        </button>
      </div>
    </div>
  );
}

export function AddListComposer({
  onAdd,
  hasLists,
  defaultOpen = false,
}: {
  onAdd: (title: string) => Promise<void>;
  hasLists: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLDivElement>(null);
  // Thêm xong: cuộn ngang để composer (đã dời sang phải) vẫn trong tầm nhìn
  const scrollIntoView = () =>
    requestAnimationFrame(() => ref.current?.scrollIntoView({ inline: 'end', block: 'nearest', behavior: 'smooth' }));
  const { value, setValue, inputRef, submit, onKeyDown } = useComposer(onAdd, scrollIntoView);
  useOutsideClick(ref, () => setOpen(false), open);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-68 shrink-0 items-center gap-2 rounded-xl bg-white/20 px-3 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/30"
      >
        <Plus size={18} />
        {hasLists ? 'Thêm danh sách khác' : 'Thêm danh sách'}
      </button>
    );
  }

  return (
    <div ref={ref} className="flex w-68 shrink-0 flex-col gap-2 rounded-xl bg-list p-2.5 shadow-md">
      <input
        ref={inputRef}
        autoFocus
        value={value}
        maxLength={100}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => onKeyDown(e, () => setOpen(false))}
        placeholder="Nhập tên danh sách..."
        aria-label="Tên danh sách mới"
        className="h-9 w-full rounded-lg bg-card px-3 text-sm text-ink shadow-sm ring-2 ring-brand outline-none placeholder:text-outline"
      />
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => void submit()} className={PRIMARY_BUTTON}>
          Thêm danh sách
        </button>
        <button type="button" onClick={() => setOpen(false)} aria-label="Huỷ" className={CLOSE_BUTTON}>
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
