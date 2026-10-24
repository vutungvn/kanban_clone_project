'use client';

import { ChevronLeft, ChevronRight, Download, ExternalLink, ImageIcon, Paperclip, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { Popover, PopoverHeader, usePopoverAnchor } from '@/components/popover';
import { toast } from '@/components/toast';
import { errorMessage } from '@/lib/api';
import {
  cardCover,
  COVER_COLORS,
  downloadAttachment,
  fileExtension,
  formatFileSize,
  isImage,
  MAX_ATTACHMENT_NAME,
  MAX_ATTACHMENT_SIZE,
} from '@/lib/attachments';
import type { Attachment, Card } from '@/lib/boards-api';
import { formatFull, formatRelative } from '@/lib/card-dates';
import { cn } from '@/lib/cn';
import type { BoardActions } from '@/lib/use-board';
import { DANGER_BUTTON, POPOVER_SECTION, PRIMARY_BUTTON, SECONDARY_BUTTON, SectionHeading, TEXT_INPUT } from './card-ui';

/** Số tệp hiện sẵn; nhiều hơn thì có nút "Xem tất cả" */
const COLLAPSED_COUNT = 5;
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';
/** Nút chữ nhỏ dưới mỗi tệp */
const FILE_ACTION =
  'rounded text-xs font-medium text-ink-subtle underline-offset-2 transition-colors hover:text-ink hover:underline aria-expanded:text-ink';

// ---------- Upload ----------

export interface UploadItem {
  id: number;
  name: string;
  /** 0 → 1 */
  progress: number;
}

let uploadSeq = 0;

/**
 * Tải nhiều tệp lên 1 thẻ cùng lúc, theo dõi tiến độ từng tệp. Tệp quá lớn / rỗng bị bỏ qua (báo toast).
 * `asCover`: tải xong thì đặt làm ảnh bìa (chỉ với ảnh).
 */
export function useAttachmentUploads(cardId: string, actions: BoardActions) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  const uploadFiles = useCallback(
    async (files: File[], { asCover = false } = {}) => {
      const valid = files.filter((file) => {
        if (file.size > MAX_ATTACHMENT_SIZE) toast.error(`"${file.name}" quá lớn — mỗi tệp tối đa 10 MB`);
        else if (file.size === 0) toast.error(`"${file.name}" là tệp rỗng`);
        else return true;
        return false;
      });
      await Promise.all(
        valid.map(async (file) => {
          const id = ++uploadSeq;
          setUploads((list) => [...list, { id, name: file.name, progress: 0 }]);
          try {
            const attachment = await actions.uploadAttachment(cardId, file, (progress) =>
              setUploads((list) => list.map((u) => (u.id === id ? { ...u, progress } : u))),
            );
            if (asCover) {
              if (isImage(attachment)) void actions.setCardCover(cardId, { attachmentId: attachment.id });
              else toast.error(`"${file.name}" không phải ảnh JPG, PNG, GIF, WEBP nên không làm ảnh bìa được`);
            }
          } catch (e) {
            toast.error(`Không tải lên được "${file.name}": ${errorMessage(e)}`);
          } finally {
            setUploads((list) => list.filter((u) => u.id !== id));
          }
        }),
      );
    },
    [cardId, actions],
  );

  return { uploads, uploadFiles };
}

/** Ô chọn tệp ẩn — mở bằng `ref.current.click()`. */
export function HiddenFileInput({
  inputRef,
  accept,
  multiple = true,
  onFiles,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      hidden
      accept={accept}
      multiple={multiple}
      onChange={(e) => {
        const files = [...(e.target.files ?? [])];
        e.target.value = ''; // chọn lại đúng tệp đó vẫn kích hoạt onChange
        if (files.length) onFiles(files);
      }}
    />
  );
}

/** Kéo thả tệp từ máy vào vùng này để đính kèm. Không được sửa thì chỉ chặn trình duyệt mở tệp. */
export function FileDropZone({
  enabled,
  onFiles,
  children,
}: {
  enabled: boolean;
  onFiles: (files: File[]) => void;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  // dragenter / dragleave bắn cả khi đi qua phần tử con → đếm số lần để biết lúc rời hẳn
  const depth = useRef(0);
  const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files');

  return (
    <div
      className="relative"
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current++;
        if (enabled) setOver(true);
      }}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = enabled ? 'copy' : 'none';
      }}
      onDragLeave={(e) => {
        if (!hasFiles(e)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        if (enabled && e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]);
      }}
    >
      {children}
      {over && (
        <div className="pointer-events-none absolute inset-0 z-20 rounded-xl border-2 border-dashed border-brand bg-brand/10">
          {/* Dính ở phần đang nhìn thấy — thẻ dài thì giữa modal có thể nằm ngoài màn hình */}
          <p className="sticky top-32 mx-auto mt-32 flex w-fit items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-brand shadow-md">
            <Paperclip size={18} aria-hidden />
            Thả tệp vào đây để đính kèm
          </p>
        </div>
      )}
    </div>
  );
}

// ---------- Mục "Tệp đính kèm" trong modal ----------

export function AttachmentSection({
  card,
  canEdit,
  actions,
  uploads,
  onAdd,
}: {
  card: Card;
  canEdit: boolean;
  actions: BoardActions;
  uploads: UploadItem[];
  onAdd: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const closeViewer = useCallback(() => setViewing(null), []);
  const files = card.attachments;
  if (!files.length && !uploads.length) return null;
  const visible = showAll ? files : files.slice(0, COLLAPSED_COUNT);

  return (
    <section className="flex flex-col gap-2">
      <SectionHeading icon={Paperclip} title="Tệp đính kèm">
        {canEdit && (
          <button type="button" onClick={onAdd} className={SECONDARY_BUTTON}>
            Thêm
          </button>
        )}
      </SectionHeading>
      <ul className="flex flex-col gap-1 pl-8">
        {uploads.map((u) => (
          <UploadRow key={u.id} item={u} />
        ))}
        {visible.map((a) => (
          <AttachmentRow
            key={a.id}
            attachment={a}
            card={card}
            canEdit={canEdit}
            actions={actions}
            onView={() => setViewing(a.id)}
          />
        ))}
      </ul>
      {files.length > COLLAPSED_COUNT && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className={cn(SECONDARY_BUTTON, 'ml-8 self-start')}>
          {showAll ? 'Thu gọn' : `Xem tất cả (${files.length})`}
        </button>
      )}
      {viewing && <AttachmentViewer images={files.filter(isImage)} startId={viewing} onClose={closeViewer} />}
    </section>
  );
}

function Thumbnail({ attachment }: { attachment: Attachment }) {
  return attachment.previewUrl ? (
    <img src={attachment.previewUrl} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
  ) : (
    <span className="text-sm font-bold tracking-wide text-ink-subtle">{fileExtension(attachment.name)}</span>
  );
}

function UploadRow({ item }: { item: UploadItem }) {
  const percent = Math.round(item.progress * 100);
  return (
    <li className="flex items-center gap-3 rounded-lg p-1.5" aria-live="polite">
      <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded bg-surface-mid text-xs font-semibold text-ink-subtle">
        {percent}%
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{item.name}</p>
        <div
          role="progressbar"
          aria-label={`Đang tải lên ${item.name}`}
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-mid"
        >
          <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-1 text-xs text-ink-subtle">{percent < 100 ? 'Đang tải lên...' : 'Đang xử lý...'}</p>
      </div>
    </li>
  );
}

function AttachmentRow({
  attachment: a,
  card,
  canEdit,
  actions,
  onView,
}: {
  attachment: Attachment;
  card: Card;
  canEdit: boolean;
  actions: BoardActions;
  onView: () => void;
}) {
  const rename = usePopoverAnchor();
  const remove = usePopoverAnchor();
  const isCover = card.coverAttachmentId === a.id;
  // Ảnh → xem ngay trong trang; tệp khác → mở ở tab mới (PDF, video... trình duyệt tự hiển thị)
  const open = () => (isImage(a) ? onView() : window.open(a.url, '_blank', 'noopener,noreferrer'));

  return (
    <li className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-surface-low">
      <button
        type="button"
        onClick={open}
        aria-label={`${isImage(a) ? 'Xem ảnh' : 'Mở tệp'} ${a.name}`}
        className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-surface-mid outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Thumbnail attachment={a} />
      </button>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={open}
          title={a.name}
          className="block max-w-full truncate text-left text-sm font-semibold text-ink hover:underline"
        >
          {a.name}
        </button>
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-subtle">
          <time dateTime={a.createdAt} title={formatFull(a.createdAt)}>
            Đã thêm {formatRelative(a.createdAt)}
          </time>
          <span aria-hidden>·</span>
          {formatFileSize(a.size)}
          {isCover && (
            <span className="inline-flex items-center gap-1 font-medium text-ink">
              <span aria-hidden className="font-normal text-ink-subtle">
                ·
              </span>
              <ImageIcon size={12} aria-hidden />
              Ảnh bìa
            </span>
          )}
        </p>
        <div className="mt-0.5 flex flex-wrap gap-x-3">
          <button type="button" onClick={() => void downloadAttachment(a)} className={FILE_ACTION}>
            Tải xuống
          </button>
          {canEdit && isImage(a) && (
            <button
              type="button"
              onClick={() => void actions.setCardCover(card.id, isCover ? null : { attachmentId: a.id })}
              className={FILE_ACTION}
            >
              {isCover ? 'Gỡ ảnh bìa' : 'Đặt làm ảnh bìa'}
            </button>
          )}
          {canEdit && (
            <>
              <button type="button" onClick={rename.toggle} aria-haspopup="dialog" aria-expanded={!!rename.anchor} className={FILE_ACTION}>
                Sửa
              </button>
              <button type="button" onClick={remove.toggle} aria-haspopup="dialog" aria-expanded={!!remove.anchor} className={FILE_ACTION}>
                Xoá
              </button>
            </>
          )}
        </div>
      </div>

      <Popover anchor={rename.anchor} onClose={rename.close} label="Sửa tệp đính kèm">
        <RenameAttachmentForm
          name={a.name}
          onClose={rename.close}
          onSave={(name) => {
            rename.close();
            if (name !== a.name) void actions.renameAttachment(a.id, name);
          }}
        />
      </Popover>

      <Popover anchor={remove.anchor} onClose={remove.close} label="Xoá tệp đính kèm">
        <PopoverHeader title="Xoá tệp đính kèm?" onClose={remove.close} />
        <p className="px-1 text-sm text-ink-subtle">
          Tệp <strong className="break-all text-ink">&quot;{a.name}&quot;</strong> sẽ bị xoá khỏi thẻ và không thể khôi phục.
          {isCover && ' Thẻ cũng sẽ không còn ảnh bìa.'}
        </p>
        <button
          type="button"
          onClick={() => {
            remove.close();
            void actions.deleteAttachment(a.id);
          }}
          className={cn(DANGER_BUTTON, 'mt-3')}
        >
          Xoá tệp
        </button>
      </Popover>
    </li>
  );
}

/** Đổi tên tệp. Ô nhập chọn sẵn phần tên (không chọn đuôi) để gõ đè cho nhanh. */
function RenameAttachmentForm({ name, onSave, onClose }: { name: string; onSave: (name: string) => void; onClose: () => void }) {
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const next = value.trim();
    if (!next) return setError('Vui lòng nhập tên tệp');
    onSave(next);
  }

  return (
    <>
      <PopoverHeader title="Sửa tệp đính kèm" onClose={onClose} />
      <form noValidate onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-subtle">
          Tên tệp
          <input
            autoFocus
            value={value}
            maxLength={MAX_ATTACHMENT_NAME}
            onFocus={(e) => {
              const dot = e.currentTarget.value.lastIndexOf('.');
              e.currentTarget.setSelectionRange(0, dot > 0 ? dot : e.currentTarget.value.length);
            }}
            onChange={(e) => {
              setValue(e.target.value);
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
        <button type="submit" className={cn(PRIMARY_BUTTON, 'h-9 w-full')}>
          Lưu
        </button>
      </form>
    </>
  );
}

// ---------- Xem ảnh toàn màn hình ----------

/** ← / → chuyển ảnh, Esc đóng (chỉ đóng trình xem, không đóng modal thẻ). */
function AttachmentViewer({ images, startId, onClose }: { images: Attachment[]; startId: string; onClose: () => void }) {
  const [currentId, setCurrentId] = useState(startId);
  const index = images.findIndex((a) => a.id === currentId);
  const current = images[index];
  const count = images.length;

  // Ảnh đang xem bị xoá (vd người khác xoá) → đóng
  useEffect(() => {
    if (!current) onClose();
  }, [current, onClose]);

  useEffect(() => {
    const step = (delta: number) => setCurrentId((id) => images[(images.findIndex((a) => a.id === id) + delta + count) % count]?.id ?? id);
    // Bắt ở pha capture trên window → chạy trước phím Esc của modal thẻ (lắng nghe ở document)
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && count > 1) step(-1);
      else if (e.key === 'ArrowRight' && count > 1) step(1);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [images, count, onClose]);

  if (!current) return null;
  const go = (delta: number) => (e: MouseEvent) => {
    e.stopPropagation();
    setCurrentId(images[(index + delta + count) % count].id);
  };
  const closeOnBackdrop = (e: MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };
  const iconButton = 'flex h-10 w-10 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white';

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Xem ảnh ${current.name}`} className="fixed inset-0 z-50 flex flex-col bg-black/90">
      <header className="flex items-center gap-2 px-4 py-3 text-white">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{current.name}</p>
          <p className="text-xs text-white/70">
            {formatFileSize(current.size)}
            {count > 1 && ` · ${index + 1}/${count}`}
          </p>
        </div>
        <button type="button" onClick={() => void downloadAttachment(current)} aria-label="Tải xuống" title="Tải xuống" className={iconButton}>
          <Download size={20} />
        </button>
        <a href={current.url} target="_blank" rel="noopener noreferrer" aria-label="Mở ở tab mới" title="Mở ở tab mới" className={iconButton}>
          <ExternalLink size={20} />
        </a>
        <button type="button" autoFocus onClick={onClose} aria-label="Đóng" title="Đóng (Esc)" className={iconButton}>
          <X size={22} />
        </button>
      </header>
      <div onClick={closeOnBackdrop} className="relative flex min-h-0 flex-1 items-center justify-center px-16 pb-10">
        <img key={current.id} src={current.url} alt={current.name} className="max-h-full max-w-full rounded object-contain shadow-2xl" />
        {count > 1 && (
          <>
            <button type="button" onClick={go(-1)} aria-label="Ảnh trước" className={cn(iconButton, 'absolute top-1/2 left-3 -translate-y-1/2 bg-white/10')}>
              <ChevronLeft size={26} />
            </button>
            <button type="button" onClick={go(1)} aria-label="Ảnh sau" className={cn(iconButton, 'absolute top-1/2 right-3 -translate-y-1/2 bg-white/10')}>
              <ChevronRight size={26} />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ---------- Ảnh bìa ----------

/** Dải ảnh bìa đầu modal: màu, hoặc ảnh (nền là chính ảnh đó làm mờ). */
export function CardCoverBanner({
  card,
  canEdit,
  roundedTop,
  expanded,
  onEdit,
}: {
  card: Card;
  canEdit: boolean;
  /** Ảnh bìa nằm sát mép trên modal (không có dải "đã lưu trữ" phía trên) */
  roundedTop: boolean;
  expanded: boolean;
  onEdit: (e: MouseEvent<HTMLElement>) => void;
}) {
  const cover = cardCover(card);
  if (!cover) return null;
  return (
    <div
      className={cn('relative flex items-center justify-center overflow-hidden', roundedTop && 'rounded-t-xl', 'image' in cover ? 'h-40 bg-ink' : 'h-24')}
      style={'color' in cover ? { backgroundColor: cover.color } : undefined}
    >
      {'image' in cover && (
        <>
          <img src={cover.image.previewUrl!} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl" />
          <img src={cover.image.previewUrl!} alt="Ảnh bìa" className="relative h-full w-auto max-w-full object-contain" />
        </>
      )}
      {canEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-haspopup="dialog"
          aria-expanded={expanded}
          className="absolute right-3 bottom-3 flex h-8 items-center gap-1.5 rounded bg-white/85 px-3 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-white"
        >
          <ImageIcon size={16} aria-hidden />
          Ảnh bìa
        </button>
      )}
    </div>
  );
}

/** Popover "Ảnh bìa": chọn màu / ảnh đã đính kèm, tải ảnh mới lên, gỡ ảnh bìa. */
export function CoverPopoverContent({
  card,
  actions,
  onUpload,
  onClose,
}: {
  card: Card;
  actions: BoardActions;
  onUpload: (files: File[]) => void;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const images = card.attachments.filter(isImage);
  const hasCover = !!cardCover(card);
  const swatch =
    'rounded outline-none transition-[box-shadow,opacity] hover:opacity-85 focus-visible:ring-2 focus-visible:ring-brand aria-pressed:ring-2 aria-pressed:ring-brand aria-pressed:ring-offset-2';

  return (
    <>
      <PopoverHeader title="Ảnh bìa" onClose={onClose} />
      {hasCover && (
        <button type="button" onClick={() => void actions.setCardCover(card.id, null)} className={cn(SECONDARY_BUTTON, 'w-full')}>
          Gỡ ảnh bìa
        </button>
      )}

      <h4 className={POPOVER_SECTION}>Màu</h4>
      <div className="grid grid-cols-5 gap-2">
        {COVER_COLORS.map((c) => {
          const selected = card.coverColor === c.key;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={selected}
              aria-label={`Màu ${c.name}`}
              title={c.name}
              onClick={() => !selected && void actions.setCardCover(card.id, { color: c.key })}
              style={{ backgroundColor: c.bg }}
              className={cn(swatch, 'h-8')}
            />
          );
        })}
      </div>

      {images.length > 0 && (
        <>
          <h4 className={POPOVER_SECTION}>Ảnh đính kèm</h4>
          <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto p-1">
            {images.map((a) => {
              const selected = card.coverAttachmentId === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`Dùng ảnh ${a.name}`}
                  title={a.name}
                  onClick={() => !selected && void actions.setCardCover(card.id, { attachmentId: a.id })}
                  className={cn(swatch, 'h-14 overflow-hidden bg-surface-mid')}
                >
                  <Thumbnail attachment={a} />
                </button>
              );
            })}
          </div>
        </>
      )}

      <button type="button" onClick={() => input.current?.click()} className={cn(SECONDARY_BUTTON, 'mt-3 w-full')}>
        Tải ảnh lên
      </button>
      <HiddenFileInput inputRef={input} accept={IMAGE_ACCEPT} multiple={false} onFiles={onUpload} />
      <p className="mt-2 text-xs text-ink-subtle">Mẹo: kéo thả tệp vào thẻ để đính kèm. Ảnh đầu tiên tự thành ảnh bìa.</p>
    </>
  );
}
