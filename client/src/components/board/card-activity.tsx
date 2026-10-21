'use client';

import { LoaderCircle, MessagesSquare, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Avatar } from '@/components/avatar';
import { Popover, PopoverHeader, usePopoverAnchor } from '@/components/popover';
import { toast } from '@/components/toast';
import { ApiError, errorMessage } from '@/lib/api';
import { activitiesApi, type Activity, type ActivityFilter, type BoardDetail, type Card } from '@/lib/boards-api';
import { formatDay, formatDayTime, formatFull, formatRelative } from '@/lib/card-dates';
import { cn } from '@/lib/cn';
import type { BoardActions } from '@/lib/use-board';
import { LabelChip, PRIMARY_BUTTON, SECONDARY_BUTTON, SectionHeading, useAutosize } from './card-ui';

const MAX_COMMENT = 5_000;
const DETAILS_KEY = 'kanban.activity-details';
const TEXTAREA =
  'w-full resize-none overflow-hidden rounded-lg bg-white px-3 py-2 text-sm leading-relaxed text-ink shadow-[0_0_0_1px_rgba(9,30,66,0.14)] outline-none placeholder:text-outline focus:shadow-[0_0_0_2px_var(--color-brand)]';
/** Nút "Sửa" / "Xoá" nhỏ dưới bình luận */
const COMMENT_ACTION =
  'inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-ink-subtle transition-colors hover:bg-surface-low hover:text-ink';

/** Bật / tắt "chi tiết" (hoạt động ngoài bình luận) — nhớ theo trình duyệt. */
function useShowDetails() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(DETAILS_KEY) === 'false') setShow(false);
    } catch {
      // Không đọc được bộ nhớ trình duyệt → giữ mặc định
    }
  }, []);
  const toggle = () =>
    setShow((v) => {
      try {
        localStorage.setItem(DETAILS_KEY, String(!v));
      } catch {
        // Bỏ qua — chỉ là tuỳ chọn hiển thị
      }
      return !v;
    });
  return [show, toggle] as const;
}

/** Thẻ đổi ở những điểm có ghi lịch sử → cần tải lại phần đầu danh sách hoạt động. */
const activitySignature = (card: Card) =>
  JSON.stringify([
    card.title,
    card.listId,
    card.labelIds,
    card.memberIds,
    card.startDate,
    card.dueDate,
    card.dueComplete,
    card.checklists.map((c) => [c.id, c.items.map((i) => i.completed)]),
  ]);

/**
 * Tải lịch sử hoạt động của thẻ (mới nhất trước, phân trang) và các thao tác với bình luận.
 * Bình luận gọi API riêng (không qua useBoard) — chỉ báo lại số bình luận cho thẻ ngoài bảng.
 */
function useCardActivity(card: Card, filter: ActivityFilter, actions: BoardActions) {
  const [items, setItems] = useState<Activity[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const cardId = card.id;

  /** Bị hạ quyền / thẻ bị xoá → đồng bộ lại bảng (modal tự đóng nếu thẻ không còn). */
  const handleError = useCallback(
    (e: unknown) => {
      toast.error(errorMessage(e));
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) actions.resync();
    },
    [actions],
  );

  // Trang đầu: khi mở thẻ hoặc đổi bộ lọc
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    activitiesApi
      .list(cardId, filter)
      .then((page) => {
        if (cancelled) return;
        setItems(page.activities);
        setNextCursor(page.nextCursor);
        setStatus('ready');
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
    };
  }, [cardId, filter]);

  // Thẻ vừa được sửa (nhãn, ngày, checklist...) → lấy các hoạt động mới ghép lên đầu
  const signature = activitySignature(card);
  const firstSignature = useRef(signature);
  useEffect(() => {
    if (filter !== 'all' || signature === firstSignature.current) return;
    firstSignature.current = signature;
    // Chờ API của thao tác vừa rồi kịp ghi xong
    const timer = setTimeout(() => {
      activitiesApi
        .list(cardId, filter)
        .then((page) => {
          const known = new Set(itemsRef.current.map((a) => a.id));
          const fresh = page.activities.filter((a) => !known.has(a.id));
          if (fresh.length) setItems((prev) => [...fresh, ...prev]);
        })
        .catch(() => undefined);
    }, 600);
    return () => clearTimeout(timer);
  }, [cardId, filter, signature]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await activitiesApi.list(cardId, filter, nextCursor);
      setItems((prev) => {
        const known = new Set(prev.map((a) => a.id));
        return [...prev, ...page.activities.filter((a) => !known.has(a.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };

  /** Chờ API (cần id thật); lỗi ném ra để ô nhập giữ lại nội dung. */
  const addComment = async (text: string) => {
    try {
      const comment = await activitiesApi.addComment(cardId, text);
      setItems((prev) => [comment, ...prev]);
      actions.changeCommentCount(cardId, 1);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) actions.resync();
      throw e;
    }
  };

  /** Đổi giao diện ngay, lỗi thì hoàn tác. */
  const editComment = async (comment: Activity, text: string) => {
    setItems((prev) => prev.map((a) => (a.id === comment.id ? { ...a, text, editedAt: new Date().toISOString() } : a)));
    try {
      const saved = await activitiesApi.updateComment(comment.id, text);
      setItems((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
    } catch (e) {
      setItems((prev) => prev.map((a) => (a.id === comment.id ? comment : a)));
      handleError(e);
    }
  };

  const deleteComment = async (comment: Activity) => {
    setItems((prev) => prev.filter((a) => a.id !== comment.id));
    actions.changeCommentCount(cardId, -1);
    try {
      await activitiesApi.removeComment(comment.id);
    } catch (e) {
      // Trả lại đúng chỗ cũ (danh sách sắp mới nhất trước)
      setItems((prev) => [...prev, comment].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      actions.changeCommentCount(cardId, 1);
      handleError(e);
    }
  };

  return { items, status, nextCursor, loadingMore, loadMore, addComment, editComment, deleteComment };
}

// ---------- Mục "Hoạt động" trong modal ----------

export function CardActivity({ board, card, actions }: { board: BoardDetail; card: Card; actions: BoardActions }) {
  const { user } = useAuth();
  const [showDetails, toggleDetails] = useShowDetails();
  const activity = useCardActivity(card, showDetails ? 'all' : 'comments', actions);
  const canComment = board.role !== 'VIEWER';
  const isAdmin = board.role === 'ADMIN';
  // Thẻ tạo trước khi có lịch sử hoạt động: vẫn hiện mốc tạo thẻ ở cuối
  const showCreatedFallback =
    showDetails && activity.status === 'ready' && !activity.nextCursor && !activity.items.some((a) => a.type === 'CARD_CREATED');

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading icon={MessagesSquare} title="Hoạt động">
        <button type="button" onClick={toggleDetails} aria-pressed={!showDetails} className={SECONDARY_BUTTON}>
          {showDetails ? 'Ẩn chi tiết' : 'Hiện chi tiết'}
        </button>
      </SectionHeading>

      {canComment && user && <CommentComposer user={user} onSubmit={activity.addComment} />}

      {activity.status === 'loading' ? (
        <p className="flex items-center gap-2 pl-11 text-sm text-ink-subtle">
          <LoaderCircle size={16} className="animate-spin" />
          Đang tải hoạt động...
        </p>
      ) : activity.status === 'error' ? (
        <p className="pl-11 text-sm text-danger">Không tải được hoạt động. Hãy đóng và mở lại thẻ.</p>
      ) : (
        <>
          {activity.items.length === 0 && !showCreatedFallback && (
            <p className="pl-11 text-sm text-ink-subtle">{showDetails ? 'Chưa có hoạt động nào.' : 'Chưa có bình luận nào.'}</p>
          )}
          <ol className="flex flex-col gap-4">
            {activity.items.map((item) =>
              item.type === 'COMMENT' ? (
                <CommentItem
                  key={item.id}
                  comment={item}
                  canEdit={canComment && item.user?.id === user?.id}
                  canDelete={canComment && (item.user?.id === user?.id || isAdmin)}
                  onEdit={(text) => void activity.editComment(item, text)}
                  onDelete={() => void activity.deleteComment(item)}
                />
              ) : (
                <ActivityItem key={item.id} activity={item} board={board} />
              ),
            )}
          </ol>
          {activity.nextCursor && (
            <button
              type="button"
              onClick={() => void activity.loadMore()}
              disabled={activity.loadingMore}
              className={cn(SECONDARY_BUTTON, 'ml-11 self-start disabled:opacity-60')}
            >
              {activity.loadingMore ? 'Đang tải...' : 'Xem hoạt động cũ hơn'}
            </button>
          )}
          {showCreatedFallback && (
            <p className="pl-11 text-xs text-ink-subtle">
              Thẻ được tạo ngày <time dateTime={card.createdAt}>{formatFull(card.createdAt)}</time>
            </p>
          )}
        </>
      )}
    </section>
  );
}

// ---------- Viết bình luận ----------

/** Bấm vào để mở ô nhập. Ctrl/⌘ + Enter = lưu, Esc = thu gọn (giữ nháp). */
function CommentComposer({
  user,
  onSubmit,
}: {
  user: { id: string; name: string };
  onSubmit: (text: string) => Promise<void>;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  useAutosize(ref, open ? value : '');

  async function submit() {
    const text = value.trim();
    if (!text || pending) return;
    setPending(true);
    try {
      await onSubmit(text);
      setValue('');
      setOpen(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-start gap-3">
      <Avatar name={user.name} seed={user.id} size={32} className="shrink-0" />
      {open ? (
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <textarea
            ref={ref}
            autoFocus
            rows={2}
            value={value}
            maxLength={MAX_COMMENT}
            placeholder="Viết bình luận..."
            aria-label="Nội dung bình luận"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void submit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
              }
            }}
            className={cn(TEXTAREA, 'min-h-16')}
          />
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => void submit()} disabled={!value.trim() || pending} className={PRIMARY_BUTTON}>
              {pending ? 'Đang lưu...' : 'Lưu'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="h-8 rounded px-3 text-sm font-medium transition-colors hover:bg-black/5">
              Huỷ
            </button>
            <span className="flex-1" />
            <span className="text-xs text-ink-subtle">Ctrl + Enter để lưu</span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'min-h-10 flex-1 truncate rounded-lg bg-white px-3 py-2 text-left text-sm shadow-[0_0_0_1px_rgba(9,30,66,0.14)] transition-colors hover:bg-surface-low',
            value ? 'text-ink' : 'text-ink-subtle',
          )}
        >
          {value || 'Viết bình luận...'}
        </button>
      )}
    </div>
  );
}

// ---------- Bình luận ----------

function Author({ activity }: { activity: Activity }) {
  return activity.user ? (
    <Avatar name={activity.user.name} seed={activity.user.id} size={32} className="shrink-0" />
  ) : (
    <span className="h-8 w-8 shrink-0 rounded-full bg-surface-high" aria-hidden />
  );
}

const authorName = (activity: Activity) => activity.user?.name ?? 'Người dùng đã bị xoá';

function Time({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} title={formatFull(iso)} className="text-xs text-ink-subtle">
      {formatRelative(iso)}
    </time>
  );
}

function CommentItem({
  comment,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  comment: Activity;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (text: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const confirm = usePopoverAnchor();

  return (
    <li className="flex items-start gap-3">
      <Author activity={comment} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <strong className="text-sm font-semibold">{authorName(comment)}</strong>
          <Time iso={comment.createdAt} />
          {comment.editedAt && (
            <span className="text-xs text-ink-subtle" title={`Sửa lúc ${formatFull(comment.editedAt)}`}>
              · đã sửa
            </span>
          )}
        </p>

        {editing ? (
          <CommentEditor
            initial={comment.text ?? ''}
            onCancel={() => setEditing(false)}
            onSave={(text) => {
              setEditing(false);
              if (text !== comment.text) onEdit(text);
            }}
          />
        ) : (
          <>
            <div
              className={cn(
                'mt-1 rounded-lg bg-white px-3 py-2 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap transition-shadow',
                // Đang hỏi xác nhận xoá → đánh dấu bình luận nào sắp bị xoá
                confirm.anchor
                  ? 'shadow-[0_0_0_2px_var(--color-danger)]'
                  : 'shadow-[0_0_0_1px_rgba(9,30,66,0.14)]',
              )}
            >
              {comment.text}
            </div>
            {(canEdit || canDelete) && (
              <div className="mt-1 -ml-2 flex items-center gap-0.5">
                {canEdit && (
                  <button type="button" onClick={() => setEditing(true)} className={COMMENT_ACTION}>
                    <Pencil size={13} aria-hidden />
                    Sửa
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={confirm.toggle}
                    aria-haspopup="dialog"
                    aria-expanded={!!confirm.anchor}
                    className={cn(COMMENT_ACTION, 'hover:bg-danger-soft/50 hover:text-danger aria-expanded:bg-danger-soft/50 aria-expanded:text-danger')}
                  >
                    <Trash2 size={13} aria-hidden />
                    Xoá
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <Popover anchor={confirm.anchor} onClose={confirm.close} label="Xoá bình luận" width={288}>
        <PopoverHeader title="Xoá bình luận?" onClose={confirm.close} />
        <blockquote className="line-clamp-3 rounded-md border-l-[3px] border-outline/40 bg-surface-low px-2.5 py-1.5 text-sm wrap-break-word whitespace-pre-wrap text-ink-subtle">
          {comment.text}
        </blockquote>
        <p className="mt-2 px-0.5 text-xs text-ink-subtle">Bình luận sẽ bị xoá vĩnh viễn, không thể khôi phục.</p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={confirm.close} className="h-9 flex-1 rounded bg-surface-mid text-sm font-medium transition-colors hover:bg-surface-high">
            Huỷ
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => {
              confirm.close();
              onDelete();
            }}
            className="h-9 flex-1 rounded bg-danger text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Xoá
          </button>
        </div>
      </Popover>
    </li>
  );
}

/** Sửa tại chỗ trong khung bình luận. Ctrl/⌘ + Enter = lưu, Esc = huỷ (không đóng modal). */
function CommentEditor({ initial, onSave, onCancel }: { initial: string; onSave: (text: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(initial);
  useAutosize(ref, value);
  const nearLimit = value.length > MAX_COMMENT * 0.9;
  const save = () => {
    const text = value.trim();
    if (text) onSave(text);
  };

  return (
    <div className="mt-1 rounded-lg bg-white shadow-[0_0_0_2px_var(--color-brand)]">
      <textarea
        ref={ref}
        autoFocus
        rows={2}
        value={value}
        maxLength={MAX_COMMENT}
        aria-label="Sửa bình luận"
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
        className="block max-h-[50vh] w-full resize-none overflow-y-auto rounded-t-lg bg-transparent px-3 pt-2 pb-1 text-sm leading-relaxed text-ink outline-none"
      />
      <div className="flex items-center gap-1.5 border-t border-surface-high px-2 py-1.5">
        <button
          type="button"
          onClick={save}
          disabled={!value.trim()}
          className="h-7 rounded bg-brand px-2.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          Lưu
        </button>
        <button type="button" onClick={onCancel} className="h-7 rounded px-2.5 text-xs font-medium transition-colors hover:bg-black/5">
          Huỷ
        </button>
        <span className="flex-1" />
        <span className={cn('hidden text-[11px] sm:inline', nearLimit ? 'font-medium text-danger' : 'text-ink-subtle')}>
          {nearLimit
            ? `${value.length.toLocaleString('vi-VN')}/${MAX_COMMENT.toLocaleString('vi-VN')}`
            : 'Ctrl + Enter để lưu · Esc để huỷ'}
        </span>
      </div>
    </div>
  );
}

// ---------- Hoạt động khác ----------

function ActivityItem({ activity, board }: { activity: Activity; board: BoardDetail }) {
  return (
    <li className="flex items-start gap-3">
      <Author activity={activity} />
      <div className="min-w-0 flex-1 pt-0.5 text-sm">
        <p className="wrap-break-word">
          <strong className="font-semibold">{authorName(activity)}</strong> {describe(activity, board)}
        </p>
        <Time iso={activity.createdAt} />
      </div>
    </li>
  );
}

const str = (value: unknown) => (typeof value === 'string' ? value : '');
const quote = (value: unknown) => <strong className="font-medium">{str(value)}</strong>;

/** Câu mô tả hoạt động (sau tên người thực hiện). */
function describe(activity: Activity, board: BoardDetail): ReactNode {
  const d = activity.data;
  const label = () => <LabelChip label={{ name: str(d.name), color: str(d.color) }} size="xs" className="mx-0.5" />;
  const isSelf = d.userId === activity.user?.id;
  // Thành viên đã rời bảng vẫn hiện tên đã chụp lại lúc đó
  const memberName = () => quote(board.members.find((m) => m.id === d.userId)?.name ?? d.name);

  switch (activity.type) {
    case 'CARD_CREATED':
      return <>đã thêm thẻ này vào danh sách {quote(d.listTitle)}</>;
    case 'CARD_RENAMED':
      return (
        <>
          đã đổi tên thẻ từ {quote(d.from)} thành {quote(d.to)}
        </>
      );
    case 'CARD_MOVED':
      return (
        <>
          đã chuyển thẻ này từ {quote(d.fromList)} sang {quote(d.toList)}
        </>
      );
    case 'LABEL_ADDED':
      return <>đã thêm nhãn {label()} vào thẻ này</>;
    case 'LABEL_REMOVED':
      return <>đã gỡ nhãn {label()} khỏi thẻ này</>;
    case 'MEMBER_ADDED':
      return isSelf ? <>đã tham gia thẻ này</> : <>đã thêm {memberName()} vào thẻ này</>;
    case 'MEMBER_REMOVED':
      return isSelf ? <>đã rời khỏi thẻ này</> : <>đã gỡ {memberName()} khỏi thẻ này</>;
    case 'DATES_CHANGED': {
      const start = typeof d.startDate === 'string' ? d.startDate : null;
      const due = typeof d.dueDate === 'string' ? d.dueDate : null;
      if (start && due) return <>đã đặt ngày của thẻ: {quote(`${formatDay(start)} - ${formatDayTime(due)}`)}</>;
      if (due) return <>đã đặt hạn chót là {quote(formatDayTime(due))}</>;
      if (start) return <>đã đặt ngày bắt đầu là {quote(formatDay(start))}</>;
      return <>đã gỡ ngày của thẻ này</>;
    }
    case 'DUE_COMPLETE_CHANGED':
      return d.complete ? <>đã đánh dấu hạn chót là hoàn thành</> : <>đã đánh dấu hạn chót là chưa hoàn thành</>;
    case 'CHECKLIST_ADDED':
      return <>đã thêm checklist {quote(d.title)} vào thẻ này</>;
    case 'CHECKLIST_REMOVED':
      return <>đã xoá checklist {quote(d.title)} khỏi thẻ này</>;
    case 'CHECKLIST_ITEM_COMPLETED':
      return (
        <>
          đã hoàn thành {quote(d.title)} trong {quote(d.checklist)}
        </>
      );
    case 'CHECKLIST_ITEM_UNCOMPLETED':
      return (
        <>
          đã đánh dấu {quote(d.title)} là chưa hoàn thành trong {quote(d.checklist)}
        </>
      );
    default:
      return <>đã cập nhật thẻ này</>;
  }
}
