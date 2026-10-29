'use client';

import { LayoutTemplate, LoaderCircle, MoreHorizontal, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-provider';
import { BackgroundPicker } from '@/components/boards/background-picker';
import { BoardsSidebar } from '@/components/boards/boards-sidebar';
import { Popover, PopoverHeader, usePopoverAnchor } from '@/components/popover';
import { TemplatePreviewModal } from '@/components/templates/template-preview-modal';
import { TemplateTile } from '@/components/templates/template-tile';
import { toast } from '@/components/toast';
import { Alert } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import type { BoardBackground } from '@/lib/board-backgrounds';
import { cn } from '@/lib/cn';
import { templatesApi, type TemplateSummary } from '@/lib/templates-api';

const ALL = 'Tất cả';
const GRID = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3';

/** /templates — mẫu có sẵn (lọc theo nhóm) + mẫu của tôi (sửa / xoá). Bấm 1 mẫu → xem trước + tạo bảng. */
export default function TemplatesPage() {
  const { user } = useAuth(); // layout đảm bảo đã có user
  const [data, setData] = useState<{ builtin: TemplateSummary[]; mine: TemplateSummary[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState(ALL);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const load = useCallback(() => {
    templatesApi.list().then(
      (d) => {
        setData(d);
        setError(null);
      },
      (e) => setError(errorMessage(e)),
    );
  }, []);
  useEffect(load, [load]);

  const categories = useMemo(() => [ALL, ...new Set(data?.builtin.map((t) => t.category ?? '') ?? [])], [data]);
  const builtin = data?.builtin.filter((t) => category === ALL || t.category === category) ?? [];

  const replaceMine = (next: TemplateSummary) =>
    setData((d) => d && { ...d, mine: d.mine.map((t) => (t.id === next.id ? next : t)) });
  const removeMine = (id: string) => setData((d) => d && { ...d, mine: d.mine.filter((t) => t.id !== id) });

  if (!user) return null;

  return (
    <div className="flex">
      <BoardsSidebar />
      <main className="min-w-0 flex-1">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
          <header>
            <h1 className="text-2xl font-semibold text-ink">Mẫu</h1>
            <p className="mt-1 text-sm text-ink-subtle">Tạo bảng mới từ mẫu có sẵn, hoặc từ mẫu bạn đã lưu từ bảng của mình.</p>
          </header>

          {error ? (
            <Alert tone="error">{error}</Alert>
          ) : !data ? (
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-ink-subtle">
              <LoaderCircle size={16} className="animate-spin" />
              Đang tải mẫu...
            </p>
          ) : (
            <>
              <section aria-labelledby="my-templates" className="flex flex-col gap-3">
                <h2 id="my-templates" className="text-base font-semibold text-ink">
                  Mẫu của tôi
                </h2>
                {data.mine.length ? (
                  <div className={GRID}>
                    {data.mine.map((t) => (
                      <TemplateTile
                        key={t.id}
                        template={t}
                        onOpen={() => setPreviewId(t.id)}
                        action={<MyTemplateMenu template={t} onUpdated={replaceMine} onDeleted={removeMine} />}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="flex items-center gap-3 rounded-xl border border-dashed border-outline/40 px-4 py-5 text-sm text-ink-subtle">
                    <LayoutTemplate size={20} className="shrink-0" />
                    <span>
                      Chưa có mẫu nào. Mở một bảng → menu <strong className="text-ink">⋯</strong> →{' '}
                      <strong className="text-ink">Lưu thành mẫu</strong> để dùng lại cấu trúc của bảng đó.
                    </span>
                  </p>
                )}
              </section>

              <section aria-labelledby="builtin-templates" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 id="builtin-templates" className="text-base font-semibold text-ink">
                    Mẫu có sẵn
                  </h2>
                  <div role="group" aria-label="Lọc theo nhóm" className="flex flex-wrap gap-1.5">
                    {categories.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={category === c}
                        onClick={() => setCategory(c)}
                        className={cn(
                          'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                          category === c ? 'bg-brand text-white' : 'bg-surface-mid text-ink hover:bg-surface-high',
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={GRID}>
                  {builtin.map((t) => (
                    <TemplateTile key={t.id} template={t} onOpen={() => setPreviewId(t.id)} />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      {previewId && (
        <TemplatePreviewModal
          templateId={previewId}
          onClose={() => {
            setPreviewId(null);
            // Mẫu có thể vừa bị xoá ở tab khác → tải lại cho đúng
            load();
          }}
        />
      )}
    </div>
  );
}

/** Nút ⋯ trên mẫu của tôi: sửa tên / mô tả / phông nền, xoá (hỏi lại trước). */
function MyTemplateMenu({
  template,
  onUpdated,
  onDeleted,
}: {
  template: TemplateSummary;
  onUpdated: (template: TemplateSummary) => void;
  onDeleted: (id: string) => void;
}) {
  const menu = usePopoverAnchor();
  return (
    <>
      <button
        type="button"
        onClick={menu.toggle}
        aria-label={`Tuỳ chọn mẫu ${template.title}`}
        aria-expanded={!!menu.anchor}
        className="flex h-7 w-7 items-center justify-center rounded text-ink-subtle transition-colors hover:bg-surface-mid hover:text-ink aria-expanded:bg-surface-mid"
      >
        <MoreHorizontal size={16} />
      </button>
      <Popover anchor={menu.anchor} onClose={menu.close} label="Sửa mẫu" align="end">
        {/* Form mount lại mỗi lần mở → tự reset state */}
        <EditTemplateForm template={template} onClose={menu.close} onUpdated={onUpdated} onDeleted={onDeleted} />
      </Popover>
    </>
  );
}

function EditTemplateForm({
  template,
  onClose,
  onUpdated,
  onDeleted,
}: {
  template: TemplateSummary;
  onClose: () => void;
  onUpdated: (template: TemplateSummary) => void;
  onDeleted: (id: string) => void;
}) {
  const [title, setTitle] = useState(template.title);
  const [description, setDescription] = useState(template.description);
  const [background, setBackground] = useState<BoardBackground>(template.background);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = title.trim();

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!trimmed || pending) return;
    setPending(true);
    setError(null);
    try {
      onUpdated(await templatesApi.update(template.id, { title: trimmed, description: description.trim(), background }));
      toast.success('Đã lưu thay đổi');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  async function remove() {
    setPending(true);
    try {
      await templatesApi.remove(template.id);
      onDeleted(template.id);
      toast.success(`Đã xoá mẫu "${template.title}"`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  if (confirming) {
    return (
      <>
        <PopoverHeader title="Xoá mẫu?" onClose={onClose} onBack={() => setConfirming(false)} />
        <p className="px-1 text-sm text-ink-subtle">
          Mẫu <strong className="text-ink">&quot;{template.title}&quot;</strong> sẽ bị xoá vĩnh viễn. Các bảng đã tạo từ mẫu này không bị ảnh hưởng.
        </p>
        {error && (
          <div className="mt-2">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        <button
          type="button"
          onClick={() => void remove()}
          disabled={pending}
          className="mt-3 h-9 w-full rounded bg-danger text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? 'Đang xoá...' : 'Xoá mẫu'}
        </button>
      </>
    );
  }

  return (
    <form onSubmit={save}>
      <PopoverHeader title="Sửa mẫu" onClose={onClose} />
      <label htmlFor="edit-template-title" className="mb-1.5 block text-xs font-semibold">
        Tên mẫu <span className="text-danger">*</span>
      </label>
      <input
        id="edit-template-title"
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={100}
        className="h-9 w-full rounded bg-card px-3 text-sm text-ink shadow-[0_0_0_1px_var(--color-hairline)] outline-none focus:shadow-[0_0_0_2px_var(--color-brand)]"
      />
      <label htmlFor="edit-template-description" className="mt-3 mb-1.5 block text-xs font-semibold">
        Mô tả
      </label>
      <textarea
        id="edit-template-description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={500}
        rows={2}
        className="w-full resize-none rounded bg-card px-3 py-2 text-sm text-ink shadow-[0_0_0_1px_var(--color-hairline)] outline-none focus:shadow-[0_0_0_2px_var(--color-brand)]"
      />
      <div className="mt-3">
        <BackgroundPicker value={background} onChange={setBackground} />
      </div>
      {error && (
        <div className="mt-2">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      <button
        type="submit"
        disabled={!trimmed || pending}
        className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded bg-brand text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-surface-mid disabled:text-outline"
      >
        {pending && <LoaderCircle size={16} className="animate-spin" />}
        Lưu
      </button>
      <hr className="-mx-3 my-3 border-surface-high" />
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm text-danger transition-colors hover:bg-danger-soft/40"
      >
        <Trash2 size={16} />
        Xoá mẫu
      </button>
    </form>
  );
}
