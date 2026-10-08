'use client';

import {
  AlignLeft,
  Archive,
  ArrowRight,
  Calendar,
  Copy,
  CreditCard,
  ImageIcon,
  MessagesSquare,
  Paperclip,
  SquareCheck,
  Tag,
  Trash2,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from 'react';
import { useAuth } from '@/components/auth-provider';
import { Avatar } from '@/components/avatar';
import { Popover, PopoverHeader, usePopoverAnchor } from '@/components/popover';
import { toast } from '@/components/toast';
import { ComingSoonBadge } from '@/components/ui';
import type { BoardDetail, Card, List } from '@/lib/boards-api';
import { cn } from '@/lib/cn';
import type { BoardActions } from '@/lib/use-board';

const MAX_TITLE = 500;
const MAX_DESCRIPTION = 10_000;

const PRIMARY_BUTTON =
  'h-8 rounded bg-brand px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover';
const SECONDARY_BUTTON = 'h-8 rounded bg-surface-mid px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-high';
const SIDEBAR_BUTTON =
  'flex w-full items-center gap-2.5 rounded bg-surface-low px-3 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-surface-mid aria-expanded:bg-surface-high disabled:cursor-not-allowed disabled:text-ink/50 disabled:hover:bg-surface-low';
const SELECT_CLASS =
  'h-9 w-full rounded bg-white px-2 text-sm text-ink shadow-[0_0_0_1px_rgba(9,30,66,0.14)] outline-none focus:shadow-[0_0_0_2px_var(--color-brand)]';

const DATE_FORMAT = new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' });
const TIME_FORMAT = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });

/** "8 thg 10, 2026 lúc 10:28" */
const formatDateTime = (iso: string) => {
  const date = new Date(iso);
  return `${DATE_FORMAT.format(date)} lúc ${TIME_FORMAT.format(date)}`;
};

// ---------- URL: /b/:boardId?card=:cardId ----------

// Mở từ trong bảng (push) → đóng bằng Back để lịch sử không bị lặp; mở thẳng từ link → đóng bằng replace.
let openedInApp = false;

/** Mở modal của 1 thẻ — thẻ nằm trên URL nên có thể gửi link cho người khác. */
export function useOpenCard() {
  const router = useRouter();
  const pathname = usePathname();
  return useCallback(
    (cardId: string) => {
      openedInApp = true;
      router.push(`${pathname}?card=${encodeURIComponent(cardId)}`, { scroll: false });
    },
    [router, pathname],
  );
}

/** Đọc thẻ đang mở trên URL + hàm đóng modal. */
export function useCardParam() {
  const router = useRouter();
  const pathname = usePathname();
  const cardId = useSearchParams().get('card');
  const close = useCallback(() => {
    if (openedInApp) {
      openedInApp = false;
      router.back();
    } else {
      router.replace(pathname, { scroll: false });
    }
  }, [router, pathname]);
  return { cardId, close };
}

// ---------- Modal ----------

/**
 * Modal chi tiết thẻ. Dùng `key={cardId}` ở nơi gọi để mỗi thẻ có state riêng.
 * Thẻ không có trong bảng (link sai, đã bị xoá) → tự đóng.
 */
export function CardDetailModal({
  board,
  cardId,
  actions,
  onClose,
}: {
  board: BoardDetail;
  cardId: string;
  actions: BoardActions;
  onClose: () => void;
}) {
  const list = board.lists.find((l) => l.cards.some((c) => c.id === cardId));
  const card = list?.cards.find((c) => c.id === cardId);
  const seen = useRef(false);
  const closed = useRef(false);

  // Chỉ đóng 1 lần (vd: xoá thẻ → tự đóng, rồi thẻ biến mất khỏi bảng cũng không đóng lần nữa)
  const close = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (card) {
      seen.current = true;
      return;
    }
    if (closed.current) return;
    if (!seen.current) toast.error('Không tìm thấy thẻ. Thẻ có thể đã bị xoá.');
    close();
  }, [card, close]);

  if (!card || !list) return null;
  return <CardModal board={board} list={list} card={card} actions={actions} onClose={close} />;
}

const FOCUSABLE = 'button:not([disabled]), textarea:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

function CardModal({
  board,
  list,
  card,
  actions,
  onClose,
}: {
  board: BoardDetail;
  list: List;
  card: Card;
  actions: BoardActions;
  onClose: () => void;
}) {
  const canEdit = board.role !== 'VIEWER';
  const dialogRef = useRef<HTMLDivElement>(null);
  const move = usePopoverAnchor();
  const remove = usePopoverAnchor();
  // Đang mở popover thì Esc / bấm nền chỉ đóng popover, chưa đóng modal
  const popoverOpen = useRef(false);
  popoverOpen.current = !!move.anchor || !!remove.anchor;
  const pressedBackdrop = useRef(false);

  // Mở: đưa focus vào modal. Đóng: trả focus về chỗ cũ (thường là thẻ vừa bấm).
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      // Ô nhập tự xử lý Esc (huỷ sửa) thì gọi preventDefault → modal giữ nguyên
      if (e.key === 'Escape' && !e.defaultPrevented && !popoverOpen.current) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  /** Giữ Tab quanh quẩn trong modal. */
  function trapFocus(e: KeyboardEvent) {
    const dialog = dialogRef.current;
    if (e.key !== 'Tab' || !dialog || !dialog.contains(e.target as Node)) return;
    const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (e.target === first || e.target === dialog)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && e.target === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    // Phủ dưới header của app (h-12), cuộn dọc khi thẻ dài
    <div
      className="fixed inset-x-0 top-12 bottom-0 z-40 flex items-start justify-center overflow-y-auto bg-black/65 px-4 py-8 backdrop-blur-[4px] sm:py-12"
      // Bấm xuống và thả ra đều ở nền mới đóng — kéo bôi đen chữ từ trong modal ra ngoài không làm đóng
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget && !popoverOpen.current;
      }}
      onClick={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) onClose();
        pressedBackdrop.current = false;
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Thẻ ${card.title}`}
        tabIndex={-1}
        onKeyDown={trapFocus}
        className="relative my-auto w-full max-w-192 rounded-xl bg-white text-ink shadow-[0_20px_48px_rgba(9,30,66,0.45)] outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          title="Đóng (Esc)"
          className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-surface-mid hover:text-ink"
        >
          <X size={20} />
        </button>

        <header className="flex items-start gap-3 px-6 pt-6 pb-3">
          <CreditCard size={24} className="mt-1.5 shrink-0 text-ink-subtle" aria-hidden />
          <div className="min-w-0 flex-1 pr-8">
            <CardTitle card={card} canEdit={canEdit} onSave={(title) => void actions.updateCard(card.id, { title })} />
            <p className="mt-0.5 text-sm text-ink-subtle">
              trong danh sách{' '}
              {canEdit ? (
                <button
                  type="button"
                  onClick={move.toggle}
                  aria-haspopup="dialog"
                  aria-expanded={!!move.anchor}
                  title="Di chuyển thẻ"
                  className="font-semibold text-ink underline underline-offset-2 transition-colors hover:text-brand"
                >
                  {list.title}
                </button>
              ) : (
                <strong className="font-semibold text-ink">{list.title}</strong>
              )}
            </p>
          </div>
        </header>

        <div className={cn('grid grid-cols-1 gap-6 px-6 pt-2 pb-8', canEdit && 'md:grid-cols-[1fr_200px]')}>
          <div className="flex min-w-0 flex-col gap-6">
            <Description card={card} canEdit={canEdit} onSave={(description) => void actions.updateCard(card.id, { description })} />
            <Activity card={card} />
          </div>

          {canEdit && (
            <aside className="flex flex-col gap-6">
              <SidebarGroup title="Thêm vào thẻ">
                {(
                  [
                    ['Thành viên', UserRound],
                    ['Nhãn', Tag],
                    ['Việc cần làm', SquareCheck],
                    ['Ngày', Calendar],
                    ['Đính kèm', Paperclip],
                    ['Ảnh bìa', ImageIcon],
                  ] as const
                ).map(([label, icon]) => (
                  <UpcomingButton key={label} label={label} icon={icon} />
                ))}
              </SidebarGroup>

              <SidebarGroup title="Thao tác">
                <SidebarButton icon={ArrowRight} label="Di chuyển" onClick={move.toggle} expanded={!!move.anchor} />
                <UpcomingButton label="Sao chép" icon={Copy} />
                <UpcomingButton label="Lưu trữ" icon={Archive} />
                <button
                  type="button"
                  onClick={remove.toggle}
                  aria-haspopup="dialog"
                  aria-expanded={!!remove.anchor}
                  className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-sm font-medium text-danger transition-colors hover:bg-danger-soft/40 aria-expanded:bg-danger-soft/40"
                >
                  <Trash2 size={18} />
                  Xoá thẻ
                </button>
              </SidebarGroup>
            </aside>
          )}
        </div>
      </div>

      <Popover anchor={move.anchor} onClose={move.close} label="Di chuyển thẻ">
        <MoveCardContent
          board={board}
          card={card}
          onClose={move.close}
          onMove={(listId, index) => {
            move.close();
            void actions.moveCard(card.id, listId, index);
          }}
        />
      </Popover>

      <Popover anchor={remove.anchor} onClose={remove.close} label="Xoá thẻ">
        <PopoverHeader title="Xoá thẻ?" onClose={remove.close} />
        <p className="px-1 text-sm text-ink-subtle">
          Thẻ <strong className="text-ink">&quot;{card.title}&quot;</strong> sẽ bị xoá vĩnh viễn và không thể khôi phục.
        </p>
        <button
          type="button"
          onClick={() => {
            remove.close();
            onClose();
            void actions.deleteCard(card.id);
          }}
          className="mt-3 h-9 w-full rounded bg-danger text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Xoá thẻ
        </button>
      </Popover>
    </div>
  );
}

// ---------- Tiêu đề ----------

/** Ô nhập tự cao theo nội dung. */
function useAutosize(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, value]);
}

/** Bấm vào để sửa. Enter / bấm ra ngoài = lưu, Esc = huỷ (không đóng modal). */
function CardTitle({ card, canEdit, onSave }: { card: Card; canEdit: boolean; onSave: (title: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(card.title);
  const cancelled = useRef(false);
  useAutosize(ref, value);

  // Tiêu đề đổi từ nơi khác (sửa nhanh, hoàn tác khi lỗi) → cập nhật nếu không đang gõ
  useEffect(() => {
    if (document.activeElement !== ref.current) setValue(card.title);
  }, [card.title]);

  if (!canEdit) {
    return <h2 className="py-1 text-2xl font-semibold wrap-break-word whitespace-pre-wrap">{card.title}</h2>;
  }

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      maxLength={MAX_TITLE}
      aria-label="Tiêu đề thẻ"
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
        if (!cancelled.current && next && next !== card.title) onSave(next);
        else setValue(card.title);
        cancelled.current = false;
      }}
      className="-ml-2 block w-full resize-none overflow-hidden rounded bg-transparent px-2 py-1 text-2xl font-semibold text-ink outline-none transition-colors hover:bg-surface-low focus:bg-white focus:ring-2 focus:ring-brand"
    />
  );
}

// ---------- Mô tả ----------

function SectionHeading({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-2">
      <div className="flex items-center gap-2.5">
        <Icon size={22} className="text-ink-subtle" aria-hidden />
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Description({
  card,
  canEdit,
  onSave,
}: {
  card: Card;
  canEdit: boolean;
  onSave: (description: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const description = card.description ?? '';

  // Bấm vào đoạn mô tả để sửa — trừ khi đang bôi đen chữ để copy
  const editOnClick = (e: MouseEvent) => {
    if (e.button === 0 && !window.getSelection()?.toString()) setEditing(true);
  };

  return (
    <section className="flex flex-col gap-2">
      <SectionHeading icon={AlignLeft} title="Mô tả">
        {canEdit && description && !editing && (
          <button type="button" onClick={() => setEditing(true)} className={SECONDARY_BUTTON}>
            Chỉnh sửa
          </button>
        )}
      </SectionHeading>

      <div className="pl-8">
        {editing ? (
          <DescriptionEditor
            initial={description}
            onCancel={() => setEditing(false)}
            onSave={(next) => {
              setEditing(false);
              if (next !== card.description) onSave(next);
            }}
          />
        ) : description ? (
          <div
            onClick={canEdit ? editOnClick : undefined}
            className={cn(
              'text-sm leading-relaxed wrap-break-word whitespace-pre-wrap text-ink',
              canEdit && 'cursor-pointer rounded -mx-2 px-2 py-1 transition-colors hover:bg-surface-low',
            )}
          >
            {description}
          </div>
        ) : canEdit ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-14 w-full rounded bg-surface-low px-3 py-2 text-left text-sm text-ink-subtle transition-colors hover:bg-surface-mid"
          >
            Thêm mô tả chi tiết hơn...
          </button>
        ) : (
          <p className="text-sm text-ink-subtle">Chưa có mô tả.</p>
        )}
      </div>
    </section>
  );
}

/** Ctrl/⌘ + Enter = lưu, Esc = huỷ. Để trống = xoá mô tả. */
function DescriptionEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (description: string | null) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(initial);
  useAutosize(ref, value);

  const save = () => onSave(value.trimEnd() || null);
  const nearLimit = value.length > MAX_DESCRIPTION * 0.9;

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={ref}
        autoFocus
        rows={4}
        value={value}
        maxLength={MAX_DESCRIPTION}
        placeholder="Thêm mô tả chi tiết hơn..."
        aria-label="Mô tả thẻ"
        onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            save();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        className="max-h-[60vh] min-h-28 w-full resize-none rounded bg-white px-3 py-2 text-sm leading-relaxed text-ink shadow-[0_0_0_1px_rgba(9,30,66,0.14)] outline-none placeholder:text-outline focus:shadow-[0_0_0_2px_var(--color-brand)]"
      />
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={save} className={PRIMARY_BUTTON}>
          Lưu
        </button>
        <button type="button" onClick={onCancel} className="h-8 rounded px-3 text-sm font-medium text-ink transition-colors hover:bg-black/5">
          Huỷ
        </button>
        <span className="flex-1" />
        <span className={cn('text-xs', nearLimit ? 'font-medium text-danger' : 'text-ink-subtle')}>
          {nearLimit ? `${value.length.toLocaleString('vi-VN')}/${MAX_DESCRIPTION.toLocaleString('vi-VN')}` : 'Ctrl + Enter để lưu'}
        </span>
      </div>
    </div>
  );
}

// ---------- Hoạt động ----------

/** Bình luận chưa có API → giữ chỗ; chỉ hiện mốc tạo thẻ. */
function Activity({ card }: { card: Card }) {
  const { user } = useAuth();
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading icon={MessagesSquare} title="Hoạt động" />
      <div className="flex items-start gap-3">
        {user && <Avatar name={user.name} seed={user.id} size={32} className="shrink-0" />}
        <div
          aria-disabled
          title="Bình luận — Sắp có"
          className="flex min-h-10 flex-1 cursor-not-allowed items-center justify-between gap-2 rounded-lg bg-surface-low px-3 py-2 text-sm text-ink-subtle"
        >
          Viết bình luận...
          <ComingSoonBadge />
        </div>
      </div>
      <p className="pl-11 text-xs text-ink-subtle">
        Thẻ được tạo ngày <time dateTime={card.createdAt}>{formatDateTime(card.createdAt)}</time>
      </p>
    </section>
  );
}

// ---------- Cột thao tác ----------

function SidebarGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="mb-1 text-[11px] font-semibold tracking-wider text-ink-subtle uppercase">{title}</h3>
      {children}
    </div>
  );
}

function SidebarButton({
  icon: Icon,
  label,
  onClick,
  expanded,
}: {
  icon: LucideIcon;
  label: string;
  onClick: (e: MouseEvent<HTMLElement>) => void;
  expanded: boolean;
}) {
  return (
    <button type="button" onClick={onClick} aria-haspopup="dialog" aria-expanded={expanded} className={SIDEBAR_BUTTON}>
      <Icon size={18} className="text-ink-subtle" />
      {label}
    </button>
  );
}

function UpcomingButton({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <button type="button" disabled title={`${label} — Sắp có`} className={SIDEBAR_BUTTON}>
      <Icon size={18} />
      <span className="flex-1">{label}</span>
      <ComingSoonBadge />
    </button>
  );
}

/** Chọn danh sách + vị trí đích. Vị trí đánh số từ 1, không tính chính thẻ này. */
function MoveCardContent({
  board,
  card,
  onClose,
  onMove,
}: {
  board: BoardDetail;
  card: Card;
  onClose: () => void;
  onMove: (listId: string, index: number) => void;
}) {
  const currentIndex = board.lists.find((l) => l.id === card.listId)?.cards.findIndex((c) => c.id === card.id) ?? 0;
  const [listId, setListId] = useState(card.listId);
  const [index, setIndex] = useState(currentIndex);
  const otherCards = (id: string) => board.lists.find((l) => l.id === id)?.cards.filter((c) => c.id !== card.id).length ?? 0;
  const slots = otherCards(listId) + 1;
  const unchanged = listId === card.listId && index === currentIndex;

  return (
    <>
      <PopoverHeader title="Di chuyển thẻ" onClose={onClose} />
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (unchanged) onClose();
          else onMove(listId, index);
        }}
      >
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-subtle">
          Danh sách
          <select
            autoFocus
            value={listId}
            onChange={(e) => {
              const next = e.target.value;
              setListId(next);
              // Về lại danh sách cũ → vị trí cũ; sang danh sách khác → cuối danh sách
              setIndex(next === card.listId ? currentIndex : otherCards(next));
            }}
            className={SELECT_CLASS}
          >
            {board.lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
                {l.id === card.listId ? ' (hiện tại)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-subtle">
          Vị trí
          <select value={index} onChange={(e) => setIndex(Number(e.target.value))} className={SELECT_CLASS}>
            {Array.from({ length: slots }, (_, i) => (
              <option key={i} value={i}>
                {i + 1}
                {listId === card.listId && i === currentIndex ? ' (hiện tại)' : ''}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={cn(PRIMARY_BUTTON, 'h-9 w-full')}>
          Di chuyển
        </button>
      </form>
    </>
  );
}
