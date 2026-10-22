'use client';

import {
  AlignLeft,
  Archive,
  ArrowRight,
  Calendar,
  Copy,
  CreditCard,
  ImageIcon,
  RotateCcw,
  Paperclip,
  Plus,
  SquareCheck,
  Tag,
  Trash2,
  UserPlus,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Avatar } from '@/components/avatar';
import { Modal, ModalCloseButton } from '@/components/modal';
import { Popover, PopoverHeader, usePopoverAnchor } from '@/components/popover';
import { toast } from '@/components/toast';
import { ComingSoonBadge } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { cardsApi, type BoardDetail, type Card, type CardWithList } from '@/lib/boards-api';
import { cn } from '@/lib/cn';
import type { BoardActions } from '@/lib/use-board';
import { CardActivity } from './card-activity';
import { resolveCard } from './card-badges';
import { CopyCardContent } from './card-copy';
import { AddChecklistPopoverContent, ChecklistSection } from './card-checklists';
import { CardDatesField, DatesPopoverContent } from './card-dates';
import { LabelsPopoverContent } from './card-labels';
import { MembersPopoverContent } from './card-members';
import { LabelChip, PRIMARY_BUTTON, SECONDARY_BUTTON, SectionHeading, useAutosize } from './card-ui';

const MAX_TITLE = 500;
const MAX_DESCRIPTION = 10_000;

const SIDEBAR_BUTTON =
  'flex w-full items-center gap-2.5 rounded bg-surface-low px-3 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-surface-mid aria-expanded:bg-surface-high disabled:cursor-not-allowed disabled:text-ink/50 disabled:hover:bg-surface-low';
const SELECT_CLASS =
  'h-9 w-full rounded bg-white px-2 text-sm text-ink shadow-[0_0_0_1px_rgba(9,30,66,0.14)] outline-none focus:shadow-[0_0_0_2px_var(--color-brand)]';

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
 * Thẻ không có trên bảng → hỏi server: đã lưu trữ (hoặc nằm trong danh sách đã lưu trữ) thì hiện bản chỉ xem
 * kèm "Khôi phục"; không tồn tại (link sai, đã bị xoá) thì tự đóng.
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
  // Thẻ không có trên bảng nhưng vẫn tồn tại (đã lưu trữ)
  const [archived, setArchived] = useState<CardWithList | null>(null);

  // Chỉ đóng 1 lần (vd: xoá thẻ → tự đóng, rồi thẻ biến mất khỏi bảng cũng không đóng lần nữa)
  const close = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (card) {
      seen.current = true;
      setArchived(null);
      return;
    }
    if (closed.current) return;
    let cancelled = false;
    cardsApi
      .get(cardId)
      .then((found) => {
        if (cancelled) return;
        if (found.archivedAt || found.listArchived) setArchived(found);
        else actions.resync(); // có trên server nhưng bảng chưa cập nhật kịp
      })
      .catch((e) => {
        if (cancelled) return;
        if (!(e instanceof ApiError && e.status === 404)) toast.error(errorMessage(e));
        else if (!seen.current) toast.error('Không tìm thấy thẻ. Thẻ có thể đã bị xoá.');
        close();
      });
    return () => {
      cancelled = true;
    };
  }, [card, cardId, actions, close]);

  if (card && list) {
    return (
      <CardModal
        board={board}
        listTitle={list.title}
        card={card}
        actions={actions}
        onClose={close}
        // Hiện ngay bản đã lưu trữ (không chờ server) để modal không chớp tắt
        onArchive={() => {
          setArchived({ ...card, archivedAt: new Date().toISOString(), listTitle: list.title, listArchived: false });
          void actions.archiveCard(card.id);
        }}
      />
    );
  }
  if (archived) {
    return <CardModal board={board} listTitle={archived.listTitle} card={archived} archived={archived} actions={actions} onClose={close} />;
  }
  return null;
}

function CardModal({
  board,
  listTitle,
  card,
  archived,
  actions,
  onClose,
  onArchive,
}: {
  board: BoardDetail;
  listTitle: string;
  card: Card;
  /** Thẻ đã lưu trữ / nằm trong danh sách đã lưu trữ → chỉ xem */
  archived?: CardWithList;
  actions: BoardActions;
  onClose: () => void;
  onArchive?: () => void;
}) {
  const canManage = board.role !== 'VIEWER';
  const canEdit = canManage && !archived;
  const copy = usePopoverAnchor();
  const meId = useAuth().user?.id;
  const move = usePopoverAnchor();
  const remove = usePopoverAnchor();
  const membersPop = usePopoverAnchor();
  const labelsPop = usePopoverAnchor();
  const datesPop = usePopoverAnchor();
  const checklistPop = usePopoverAnchor();
  // Gợi ý "Tham gia" khi mình chưa được giao thẻ này
  const canJoin = canEdit && !!meId && board.members.some((m) => m.id === meId) && !card.memberIds.includes(meId);

  return (
    <Modal label={`Thẻ ${card.title}`} onClose={onClose} className="max-w-192">
      {archived && (
        <ArchivedBanner
          archived={archived}
          canManage={canManage}
          onRestore={async () => {
            try {
              await actions.restoreCard(card.id);
              toast.success('Đã khôi phục thẻ');
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
          onDelete={remove.toggle}
          deleteExpanded={!!remove.anchor}
        />
      )}
      <ModalCloseButton onClick={onClose} />

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
                {listTitle}
              </button>
            ) : (
              <strong className="font-semibold text-ink">{listTitle}</strong>
            )}
          </p>
        </div>
      </header>

      <div className={cn('grid grid-cols-1 gap-6 px-6 pt-2 pb-8', canEdit && 'md:grid-cols-[1fr_200px]')}>
        <div className="flex min-w-0 flex-col gap-6">
          <CardMeta
            board={board}
            card={card}
            canEdit={canEdit}
            membersPop={membersPop}
            labelsPop={labelsPop}
            datesPop={datesPop}
            onToggleComplete={(dueComplete) => void actions.updateCard(card.id, { dueComplete })}
          />
          <Description card={card} canEdit={canEdit} onSave={(description) => void actions.updateCard(card.id, { description })} />
          {card.checklists.map((checklist) => (
            <ChecklistSection key={checklist.id} checklist={checklist} canEdit={canEdit} actions={actions} />
          ))}
          <CardActivity board={board} card={card} actions={actions} readOnly={!!archived} />
        </div>

        {canEdit && (
          <aside className="flex flex-col gap-6">
            {canJoin && (
              <SidebarGroup title="Gợi ý">
                <button type="button" onClick={() => void actions.setCardMember(card.id, meId!, true)} className={SIDEBAR_BUTTON}>
                  <UserPlus size={18} className="text-ink-subtle" />
                  Tham gia
                </button>
              </SidebarGroup>
            )}

            <SidebarGroup title="Thêm vào thẻ">
              <SidebarButton icon={UserRound} label="Thành viên" onClick={membersPop.toggle} expanded={!!membersPop.anchor} />
              <SidebarButton icon={Tag} label="Nhãn" onClick={labelsPop.toggle} expanded={!!labelsPop.anchor} />
              <SidebarButton icon={SquareCheck} label="Việc cần làm" onClick={checklistPop.toggle} expanded={!!checklistPop.anchor} />
              <SidebarButton icon={Calendar} label="Ngày" onClick={datesPop.toggle} expanded={!!datesPop.anchor} />
              <UpcomingButton label="Đính kèm" icon={Paperclip} />
              <UpcomingButton label="Ảnh bìa" icon={ImageIcon} />
            </SidebarGroup>

            <SidebarGroup title="Thao tác">
              <SidebarButton icon={ArrowRight} label="Di chuyển" onClick={move.toggle} expanded={!!move.anchor} />
              <SidebarButton icon={Copy} label="Sao chép" onClick={copy.toggle} expanded={!!copy.anchor} />
              <button type="button" onClick={onArchive} className={SIDEBAR_BUTTON}>
                <Archive size={18} className="text-ink-subtle" />
                Lưu trữ
              </button>
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

      <Popover anchor={membersPop.anchor} onClose={membersPop.close} label="Thành viên của thẻ">
        <MembersPopoverContent board={board} card={card} actions={actions} onClose={membersPop.close} />
      </Popover>

      <Popover anchor={labelsPop.anchor} onClose={labelsPop.close} label="Nhãn của thẻ">
        <LabelsPopoverContent board={board} card={card} actions={actions} onClose={labelsPop.close} />
      </Popover>

      <Popover anchor={datesPop.anchor} onClose={datesPop.close} label="Ngày của thẻ" width={320}>
        <DatesPopoverContent card={card} onSave={(input) => void actions.updateCard(card.id, input)} onClose={datesPop.close} />
      </Popover>

      <Popover anchor={checklistPop.anchor} onClose={checklistPop.close} label="Thêm checklist">
        <AddChecklistPopoverContent onAdd={(title) => actions.addChecklist(card.id, title)} onClose={checklistPop.close} />
      </Popover>

      <Popover anchor={copy.anchor} onClose={copy.close} label="Sao chép thẻ">
        <CopyCardContent
          board={board}
          card={card}
          onClose={copy.close}
          onCopy={async (input) => {
            await actions.copyCard(card.id, input);
            toast.success(`Đã sao chép thẻ "${input.title}"`);
          }}
        />
      </Popover>

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
    </Modal>
  );
}

// ---------- Thẻ đã lưu trữ ----------

/** Dải vàng đầu modal: thẻ đã lưu trữ (Khôi phục / Xoá) hoặc nằm trong danh sách đã lưu trữ. */
function ArchivedBanner({
  archived,
  canManage,
  onRestore,
  onDelete,
  deleteExpanded,
}: {
  archived: CardWithList;
  canManage: boolean;
  onRestore: () => Promise<void>;
  onDelete: (e: MouseEvent<HTMLElement>) => void;
  deleteExpanded: boolean;
}) {
  const [pending, setPending] = useState(false);
  const cardArchived = !!archived.archivedAt;

  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-t-xl bg-[#fff7d6] px-6 py-3 pr-14 text-sm text-[#533f04]">
      <Archive size={18} className="shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 font-medium">
        {cardArchived ? (
          'Thẻ này đã được lưu trữ.'
        ) : (
          <>
            Thẻ này nằm trong danh sách <strong>{archived.listTitle}</strong> đã được lưu trữ.
          </>
        )}
      </span>
      {canManage && cardArchived && (
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              await onRestore();
              setPending(false);
            }}
            className="flex h-8 items-center gap-1.5 rounded bg-white/70 px-3 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-white disabled:opacity-60"
          >
            <RotateCcw size={15} />
            {pending ? 'Đang khôi phục...' : 'Khôi phục'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-haspopup="dialog"
            aria-expanded={deleteExpanded}
            className="flex h-8 items-center gap-1.5 rounded bg-danger px-3 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <Trash2 size={15} />
            Xoá
          </button>
        </span>
      )}
    </div>
  );
}

// ---------- Tiêu đề ----------

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

type PopoverControl = ReturnType<typeof usePopoverAnchor>;

/** Hàng thông tin dưới tiêu đề: thành viên, nhãn, ngày — chỉ hiện nhóm đã có dữ liệu. */
function CardMeta({
  board,
  card,
  canEdit,
  membersPop,
  labelsPop,
  datesPop,
  onToggleComplete,
}: {
  board: BoardDetail;
  card: Card;
  canEdit: boolean;
  membersPop: PopoverControl;
  labelsPop: PopoverControl;
  datesPop: PopoverControl;
  onToggleComplete: (complete: boolean) => void;
}) {
  const { labels, members } = resolveCard(card, board.labels, board.members);
  const hasDates = !!card.startDate || !!card.dueDate;
  if (!members.length && !labels.length && !hasDates) return null;

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-4 pl-8">
      {members.length > 0 && (
        <MetaGroup title="Thành viên">
          {members.map((m) => (
            <Avatar key={m.id} name={m.name} seed={m.id} size={32} />
          ))}
          {canEdit && <AddMetaButton label="Thêm thành viên" control={membersPop} />}
        </MetaGroup>
      )}
      {labels.length > 0 && (
        <MetaGroup title="Nhãn">
          {labels.map((l) =>
            canEdit ? (
              <button
                key={l.id}
                type="button"
                onClick={labelsPop.toggle}
                aria-haspopup="dialog"
                className="max-w-48 rounded transition-opacity hover:opacity-85"
              >
                <LabelChip label={l} className="w-full" />
              </button>
            ) : (
              <LabelChip key={l.id} label={l} className="max-w-48" />
            ),
          )}
          {canEdit && <AddMetaButton label="Thêm nhãn" control={labelsPop} />}
        </MetaGroup>
      )}
      {hasDates && (
        <MetaGroup title={card.dueDate ? 'Ngày hết hạn' : 'Ngày bắt đầu'}>
          <CardDatesField
            card={card}
            canEdit={canEdit}
            expanded={!!datesPop.anchor}
            onOpen={datesPop.toggle}
            onToggleComplete={onToggleComplete}
          />
        </MetaGroup>
      )}
    </div>
  );
}

function MetaGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <h3 className="text-xs font-semibold text-ink-subtle">{title}</h3>
      <div className="flex flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

function AddMetaButton({ label, control }: { label: string; control: PopoverControl }) {
  return (
    <button
      type="button"
      onClick={control.toggle}
      aria-haspopup="dialog"
      aria-expanded={!!control.anchor}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-low text-ink-subtle transition-colors hover:bg-surface-mid hover:text-ink aria-expanded:bg-surface-high"
    >
      <Plus size={16} />
    </button>
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

// ---------- Cột thao tác ----------

function SidebarGroup({ title, children }: { title: string; children: ReactNode }) {
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
