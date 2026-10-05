'use client';

import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Eye,
  EyeOff,
  Info,
  LoaderCircle,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Gợi ý hiển thị dưới ô nhập (bị thay bằng lỗi nếu có) */
  hint?: ReactNode;
  /** Chữ nhỏ bên phải nhãn */
  labelAside?: ReactNode;
  error?: string;
  /** Nút/biểu tượng bên phải trong ô nhập */
  trailing?: ReactNode;
};

export function Field({
  id,
  label,
  icon: Icon,
  hint,
  labelAside,
  error,
  trailing,
  className,
  ...props
}: FieldProps) {
  const messageId = `${id}-message`;
  const trailingContent =
    trailing ?? (error ? <CircleAlert size={18} className="pointer-events-none text-danger" /> : null);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className={cn('text-sm font-semibold', error ? 'text-danger' : 'text-ink')}>
          {label}
        </label>
        {labelAside && (
          <span className={cn('text-[11px] font-medium', error ? 'text-danger' : 'text-ink-subtle')}>
            {labelAside}
          </span>
        )}
      </div>

      <div className="relative flex items-center">
        {Icon && (
          <Icon
            size={18}
            aria-hidden
            className={cn('pointer-events-none absolute left-3', error ? 'text-danger' : 'text-ink-subtle')}
          />
        )}
        <input
          id={id}
          name={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className={cn(
            'h-10 w-full rounded bg-white text-sm text-ink transition-shadow outline-none placeholder:text-outline',
            Icon ? 'pl-9' : 'pl-3',
            trailingContent ? 'pr-10' : 'pr-3',
            error
              ? 'shadow-[0_0_0_1.5px_var(--color-danger)] focus:shadow-[0_0_0_2px_var(--color-danger)]'
              : 'shadow-[0_0_0_1px_rgba(9,30,66,0.14)] focus:shadow-[0_0_0_2px_var(--color-brand)]',
            className,
          )}
          {...props}
        />
        {trailingContent && <div className="absolute right-2.5 flex items-center">{trailingContent}</div>}
      </div>

      {error ? (
        <p id={messageId} role="alert" className="flex items-center gap-1.5 text-xs font-medium text-danger">
          <CircleAlert size={14} className="shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="flex items-center gap-1.5 text-xs text-ink-subtle">
          <Info size={14} className="shrink-0" />
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordField(props: Omit<FieldProps, 'type' | 'trailing'>) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <Field
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          className="rounded p-1 text-ink-subtle transition-colors hover:bg-surface-high hover:text-ink"
        >
          <Icon size={18} />
        </button>
      }
    />
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded bg-brand text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-hover hover:shadow active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <>
          <LoaderCircle size={16} className="animate-spin" />
          Đang xử lý...
        </>
      ) : (
        <>
          {children}
          <ArrowRight size={16} />
        </>
      )}
    </button>
  );
}

const ALERT_STYLES = {
  success: { box: 'bg-success-soft/30 text-success-ink', icon: CircleCheck, iconColor: 'text-success' },
  error: { box: 'bg-danger-soft/50 text-danger', icon: CircleAlert, iconColor: 'text-danger' },
} as const;

export function Alert({
  tone,
  children,
  onClose,
}: {
  tone: keyof typeof ALERT_STYLES;
  children: ReactNode;
  onClose?: () => void;
}) {
  const { box, icon: Icon, iconColor } = ALERT_STYLES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2 rounded px-2.5 py-2 text-xs leading-snug', box)}
    >
      <Icon size={16} className={cn('mt-px shrink-0', iconColor)} />
      <div className="flex-1">{children}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** Nhãn cho mục giao diện đã có chỗ nhưng chưa có chức năng. */
export function ComingSoonBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded bg-surface-mid px-1.5 py-0.5 text-[10px] font-semibold text-brand-hover',
        className,
      )}
    >
      Sắp có
    </span>
  );
}

export function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoaderCircle size={32} className="animate-spin text-brand" />
    </div>
  );
}
