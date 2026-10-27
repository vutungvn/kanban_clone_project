'use client';

import { SquareCheck, Trash2, X } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Popover, PopoverHeader, usePopoverAnchor } from '@/components/popover';
import { toast } from '@/components/toast';
import { errorMessage } from '@/lib/api';
import type { Checklist, ChecklistItem } from '@/lib/boards-api';
import { cn } from '@/lib/cn';
import type { BoardActions } from '@/lib/use-board';
import { useOutsideClick } from '@/lib/use-outside-click';
import { InlineTitle } from './inline-title';
import { DANGER_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON, SectionHeading, TEXT_INPUT, useAutosize } from './card-ui';

const MAX_CHECKLIST_TITLE = 255;
const MAX_ITEM_TITLE = 500;
const ITEM_INPUT =
  'w-full resize-none overflow-hidden rounded bg-card px-2.5 py-1.5 text-sm text-ink shadow-[0_0_0_2px_var(--color-brand)] outline-none placeholder:text-outline';

/** Số mục đã xong / tổng số mục của mọi checklist trong thẻ. */
export function checklistProgress(checklists: Checklist[]) {
  const items = checklists.flatMap((c) => c.items);
  return { done: items.filter((i) => i.completed).length, total: items.length };
}

/** Popover "Thêm checklist": nhập tên (mặc định "Việc cần làm"). */
export function AddChecklistPopoverContent({
  onAdd,
  onClose,
}: {
  onAdd: (title: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('Việc cần làm');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = title.trim();
    if (!value) return setError('Vui lòng nhập tên checklist');
    setPending(true);
    try {
      await onAdd(value);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <>
      <PopoverHeader title="Thêm checklist" onClose={onClose} />
      <form noValidate onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-subtle">
          Tiêu đề
          <input
            autoFocus
            value={title}
            maxLength={MAX_CHECKLIST_TITLE}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              setTitle(e.target.value);
              setError(null);
            }}
            className={cn(TEXT_INPUT, 'font-normal')}
          />
        </label>
        {error && (
          <p role="alert" className="text-xs font-medium text-danger">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} className={cn(PRIMARY_BUTTON, 'h-9 w-full')}>
          {pending ? 'Đang thêm...' : 'Thêm'}
        </button>
      </form>
    </>
  );
}

/** Một checklist trong modal: tiêu đề, thanh tiến độ, các mục, ô thêm mục. */
export function ChecklistSection({
  checklist,
  canEdit,
  actions,
}: {
  checklist: Checklist;
  canEdit: boolean;
  actions: BoardActions;
}) {
  const [hideChecked, setHideChecked] = useState(false);
  const [adding, setAdding] = useState(false);
  const remove = usePopoverAnchor();
  const { done, total } = checklistProgress([checklist]);
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const items = hideChecked ? checklist.items.filter((i) => !i.completed) : checklist.items;

  return (
    <section className="flex flex-col gap-2" aria-label={`Checklist ${checklist.title}`}>
      <SectionHeading
        icon={SquareCheck}
        title={
          <InlineTitle
            as="h3"
            value={checklist.title}
            editable={canEdit}
            label="tên checklist"
            maxLength={MAX_CHECKLIST_TITLE}
            onSave={(title) => void actions.renameChecklist(checklist.id, title)}
            className="rounded px-1 py-0.5 text-base font-semibold wrap-break-word hover:bg-surface-low"
            inputClassName="h-8 w-full bg-card px-2 text-base font-semibold text-ink ring-2 ring-brand"
          />
        }
      >
        <div className="flex shrink-0 items-center gap-1.5">
          {done > 0 && (
            <button type="button" onClick={() => setHideChecked((v) => !v)} className={SECONDARY_BUTTON}>
              {hideChecked ? `Hiện mục đã chọn (${done})` : 'Ẩn mục đã chọn'}
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={remove.toggle}
              aria-haspopup="dialog"
              aria-expanded={!!remove.anchor}
              className={SECONDARY_BUTTON}
            >
              Xoá
            </button>
          )}
        </div>
      </SectionHeading>

      <div className="flex items-center gap-2.5">
        <span className="w-8 shrink-0 text-right text-[11px] text-ink-subtle">{percent}%</span>
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Đã xong ${done}/${total} mục`}
          className="h-2 flex-1 overflow-hidden rounded-full bg-surface-mid"
        >
          <div
            style={{ width: `${percent}%` }}
            className={cn('h-full rounded-full transition-[width] duration-300', percent === 100 ? 'bg-success' : 'bg-brand')}
          />
        </div>
      </div>

      {items.length > 0 && (
        <ul className="flex flex-col">
          {items.map((item) => (
            <ChecklistItemRow key={item.id} item={item} canEdit={canEdit} actions={actions} />
          ))}
        </ul>
      )}
      {hideChecked && items.length === 0 && total > 0 && (
        <p className="pl-10 text-sm text-ink-subtle">Mọi mục đã hoàn thành!</p>
      )}

      {canEdit && (
        <div className="pl-10">
          {adding ? (
            <AddItemComposer onAdd={(title) => actions.addChecklistItem(checklist.id, title)} onClose={() => setAdding(false)} />
          ) : (
            <button type="button" onClick={() => setAdding(true)} className={SECONDARY_BUTTON}>
              Thêm một mục
            </button>
          )}
        </div>
      )}

      <Popover anchor={remove.anchor} onClose={remove.close} label="Xoá checklist" align="end">
        <PopoverHeader title={`Xoá ${checklist.title}?`} onClose={remove.close} />
        <p className="px-1 text-sm text-ink-subtle">Checklist và {total} mục bên trong sẽ bị xoá vĩnh viễn, không thể khôi phục.</p>
        <button
          type="button"
          onClick={() => {
            remove.close();
            void actions.deleteChecklist(checklist.id);
          }}
          className={cn(DANGER_BUTTON, 'mt-3')}
        >
          Xoá checklist
        </button>
      </Popover>
    </section>
  );
}

function ChecklistItemRow({ item, canEdit, actions }: { item: ChecklistItem; canEdit: boolean; actions: BoardActions }) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="group flex items-start gap-2.5 rounded py-1 pr-1 pl-2.5 transition-colors hover:bg-surface-low">
      <input
        type="checkbox"
        checked={item.completed}
        disabled={!canEdit}
        onChange={(e) => void actions.updateChecklistItem(item.id, { completed: e.target.checked })}
        aria-label={item.title}
        className="mt-1.5 h-4 w-4 shrink-0 accent-brand disabled:cursor-not-allowed"
      />
      {editing ? (
        <ItemEditor
          initial={item.title}
          onCancel={() => setEditing(false)}
          onSave={(title) => {
            setEditing(false);
            if (title !== item.title) void actions.updateChecklistItem(item.id, { title });
          }}
        />
      ) : (
        <>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              title="Bấm để sửa"
              className={cn(
                'min-w-0 flex-1 py-1 text-left text-sm wrap-break-word whitespace-pre-wrap',
                item.completed && 'text-ink-subtle line-through',
              )}
            >
              {item.title}
            </button>
          ) : (
            <span
              className={cn('min-w-0 flex-1 py-1 text-sm wrap-break-word whitespace-pre-wrap', item.completed && 'text-ink-subtle line-through')}
            >
              {item.title}
            </span>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => void actions.deleteChecklistItem(item.id)}
              aria-label={`Xoá mục "${item.title}"`}
              title="Xoá mục"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-subtle opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-surface-high hover:text-danger focus-visible:opacity-100"
            >
              <Trash2 size={14} />
            </button>
          )}
        </>
      )}
    </li>
  );
}

/** Sửa nội dung mục: Enter / bấm ra ngoài = lưu, Esc = huỷ (không đóng modal). */
function ItemEditor({ initial, onSave, onCancel }: { initial: string; onSave: (title: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(initial);
  const cancelled = useRef(false);
  useAutosize(ref, value);

  return (
    <textarea
      ref={ref}
      autoFocus
      rows={1}
      value={value}
      maxLength={MAX_ITEM_TITLE}
      aria-label="Nội dung mục"
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
      onBlur={() => {
        const next = value.trim();
        if (!cancelled.current && next) onSave(next);
        else onCancel();
      }}
      className={ITEM_INPUT}
    />
  );
}

/** Thêm mục: Enter thêm và giữ ô mở để nhập tiếp; Esc / bấm ra ngoài / nút X để đóng. */
function AddItemComposer({ onAdd, onClose }: { onAdd: (title: string) => Promise<void>; onClose: () => void }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState('');
  useAutosize(ref, value);
  useOutsideClick(wrapper, onClose);

  async function submit() {
    const title = value.trim();
    ref.current?.focus();
    if (!title) return;
    setValue('');
    try {
      await onAdd(title);
    } catch (e) {
      setValue(title);
      toast.error(errorMessage(e));
    }
  }

  return (
    <div ref={wrapper} className="flex flex-col gap-2">
      <textarea
        ref={ref}
        autoFocus
        rows={2}
        value={value}
        maxLength={MAX_ITEM_TITLE}
        placeholder="Thêm một mục"
        aria-label="Nội dung mục mới"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void submit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
        className={ITEM_INPUT}
      />
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => void submit()} className={PRIMARY_BUTTON}>
          Thêm
        </button>
        <button type="button" onClick={onClose} aria-label="Huỷ" className="flex h-8 w-8 items-center justify-center rounded text-ink transition-colors hover:bg-black/5">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
