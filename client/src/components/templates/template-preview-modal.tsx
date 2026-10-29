'use client';

import { AlignLeft, CheckSquare, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { BackgroundPicker } from '@/components/boards/background-picker';
import { Modal, ModalCloseButton } from '@/components/modal';
import { toast } from '@/components/toast';
import { Alert } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { backgroundClass, type BoardBackground } from '@/lib/board-backgrounds';
import { boardsStore } from '@/lib/boards-store';
import { cn } from '@/lib/cn';
import { labelColor, labelDisplayName } from '@/lib/labels';
import { templateMeta, templatesApi, type TemplateCard, type TemplateContent, type TemplateDetail } from '@/lib/templates-api';
import { useWorkspaces } from '@/lib/workspaces-store';
import { defaultWorkspaceId, VisibilitySelect, WorkspaceSelect } from '@/components/workspaces/workspace-select';
import type { BoardVisibility } from '@/lib/boards-api';

const MAX_BOARD_TITLE = 100;

/**
 * Xem trước 1 mẫu (danh sách + thẻ, chỉ xem) kèm form tạo bảng: tiêu đề, phông nền (xem trước đổi màu theo),
 * "Giữ thẻ". Tạo xong mở luôn bảng mới.
 */
export function TemplatePreviewModal({ templateId, onClose }: { templateId: string; onClose: () => void }) {
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    templatesApi.get(templateId).then(
      (t) => !cancelled && setTemplate(t),
      (e) => !cancelled && setLoadError(errorMessage(e)),
    );
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  return (
    <Modal label={template ? `Mẫu ${template.title}` : 'Xem trước mẫu'} onClose={onClose} className="max-w-5xl">
      <ModalCloseButton onClick={onClose} />
      {template ? (
        <PreviewBody template={template} onClose={onClose} />
      ) : loadError ? (
        <div className="p-8">
          <Alert tone="error">{loadError}</Alert>
        </div>
      ) : (
        <p className="flex items-center justify-center gap-2 py-24 text-sm text-ink-subtle">
          <LoaderCircle size={16} className="animate-spin" />
          Đang tải mẫu...
        </p>
      )}
    </Modal>
  );
}

function PreviewBody({ template, onClose }: { template: TemplateDetail; onClose: () => void }) {
  const router = useRouter();
  const workspaces = useWorkspaces();
  const [pickedWorkspace, setPickedWorkspace] = useState<string | null>(null);
  const workspaceId = pickedWorkspace ?? defaultWorkspaceId(workspaces);
  const [visibility, setVisibility] = useState<BoardVisibility>('WORKSPACE');
  const [title, setTitle] = useState(template.title);
  const [background, setBackground] = useState<BoardBackground>(template.background);
  const [keepCards, setKeepCards] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = title.trim();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed || pending) return;
    setPending(true);
    setError(null);
    try {
      const board = await boardsStore.createFromTemplate(template.id, {
        title: trimmed,
        background,
        keepCards,
        workspaceId: workspaceId || undefined,
        visibility,
      });
      toast.success(`Đã tạo bảng "${board.title}" từ mẫu`);
      onClose();
      router.push(`/b/${board.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 p-5 sm:p-6">
        <header className="pr-10">
          {template.category && (
            <span className="mb-2 inline-block rounded bg-surface-mid px-2 py-0.5 text-[11px] font-semibold text-ink-subtle">{template.category}</span>
          )}
          <h2 className="text-xl font-semibold text-ink">{template.title}</h2>
          {template.description && <p className="mt-1 text-sm text-ink-subtle">{template.description}</p>}
          <p className="mt-1 text-xs text-ink-subtle">{templateMeta(template)}</p>
        </header>
        <div className={cn('mt-4 overflow-x-auto rounded-lg bg-linear-to-br p-3 transition-colors', backgroundClass(background))}>
          <PreviewLists content={template.content} showCards={keepCards} />
        </div>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3 border-t border-surface-high p-5 sm:p-6 lg:border-t-0 lg:border-l">
        <h3 className="text-sm font-semibold text-ink">Tạo bảng từ mẫu này</h3>
        <div>
          <label htmlFor="template-board-title" className="mb-1.5 block text-xs font-semibold">
            Tiêu đề bảng <span className="text-danger">*</span>
          </label>
          <input
            id="template-board-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={MAX_BOARD_TITLE}
            className="h-9 w-full rounded bg-card px-3 text-sm text-ink shadow-[0_0_0_1px_var(--color-hairline)] outline-none focus:shadow-[0_0_0_2px_var(--color-brand)]"
          />
          {!trimmed && <p className="mt-1.5 text-xs text-ink-subtle">👋 Tiêu đề bảng là bắt buộc</p>}
        </div>
        <WorkspaceSelect id="template-board-workspace" workspaces={workspaces} value={workspaceId} onChange={setPickedWorkspace} />
        <VisibilitySelect id="template-board-visibility" value={visibility} onChange={setVisibility} />
        <BackgroundPicker value={background} onChange={setBackground} />
        <label className="flex cursor-pointer items-start gap-2 text-sm text-ink">
          <input type="checkbox" checked={keepCards} onChange={(e) => setKeepCards(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
          <span>
            Giữ thẻ
            <span className="block text-xs text-ink-subtle">Bỏ chọn: chỉ tạo các danh sách và nhãn.</span>
          </span>
        </label>
        <p className="text-xs text-ink-subtle">Bạn là quản trị viên của bảng mới. Thẻ chưa có người được giao và ngày; checklist chưa hoàn thành.</p>
        {error && <Alert tone="error">{error}</Alert>}
        <button
          type="submit"
          disabled={!trimmed || pending}
          className="mt-auto flex h-9 w-full items-center justify-center gap-2 rounded bg-brand text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-surface-mid disabled:text-outline"
        >
          {pending && <LoaderCircle size={16} className="animate-spin" />}
          {pending ? 'Đang tạo...' : 'Tạo bảng'}
        </button>
      </form>
    </div>
  );
}

/** Các danh sách của mẫu, thu nhỏ, chỉ xem. */
function PreviewLists({ content, showCards }: { content: TemplateContent; showCards: boolean }) {
  return (
    <ol className="flex items-start gap-2.5">
      {content.lists.map((list, i) => (
        <li key={i} className="flex w-52 shrink-0 flex-col gap-1.5 rounded-lg bg-surface-low p-2 shadow-sm">
          <p className="px-1 text-xs font-semibold text-ink">{list.title}</p>
          {showCards && list.cards.map((card, j) => <PreviewCard key={j} card={card} labels={content.labels} />)}
          {(!showCards || !list.cards.length) && <p className="px-1 pb-1 text-[11px] text-ink-subtle">Chưa có thẻ</p>}
        </li>
      ))}
    </ol>
  );
}

function PreviewCard({ card, labels }: { card: TemplateCard; labels: TemplateContent['labels'] }) {
  const items = card.checklists?.reduce((n, c) => n + c.items.length, 0) ?? 0;
  return (
    <div className="overflow-hidden rounded-md bg-card text-ink shadow-[0_1px_1px_rgba(9,30,66,0.25)]">
      {card.coverColor && <div className="h-5" style={{ backgroundColor: labelColor(card.coverColor).bg }} />}
      <div className="flex flex-col gap-1 px-2 py-1.5">
        {!!card.labels?.length && (
          <div className="flex flex-wrap gap-1">
            {card.labels.map((k) => {
              const label = labels[k];
              if (!label) return null;
              const color = labelColor(label.color);
              return (
                <span
                  key={k}
                  title={labelDisplayName(label)}
                  className="h-4 max-w-full min-w-8 truncate rounded px-1.5 text-[10px] leading-4 font-medium"
                  style={{ backgroundColor: color.bg, color: color.fg }}
                >
                  {label.name}
                </span>
              );
            })}
          </div>
        )}
        <p className="text-xs leading-snug wrap-break-word">{card.title}</p>
        {(card.description || items > 0) && (
          <div className="flex items-center gap-2 text-[11px] text-ink-subtle">
            {card.description && <AlignLeft size={12} aria-label="Có mô tả" />}
            {items > 0 && (
              <span className="flex items-center gap-0.5">
                <CheckSquare size={12} aria-hidden />
                0/{items}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
