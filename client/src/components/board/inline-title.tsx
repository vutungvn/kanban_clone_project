'use client';

import { useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Tiêu đề bấm vào để sửa tại chỗ (tên bảng, tên danh sách).
 * Enter / bấm ra ngoài = lưu, Esc = huỷ. Chuỗi rỗng hoặc không đổi thì bỏ qua.
 */
export function InlineTitle({
  value,
  onSave,
  editable,
  as: Tag = 'h2',
  label,
  maxLength,
  className,
  inputClassName,
}: {
  value: string;
  onSave: (next: string) => void;
  editable: boolean;
  as?: 'h1' | 'h2' | 'h3';
  /** Mô tả cho trình đọc màn hình, vd "tên danh sách" */
  label: string;
  maxLength?: number;
  /** Class cho phần hiển thị chữ */
  className?: string;
  /** Class cho ô nhập khi đang sửa */
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const cancelled = useRef(false);

  if (!editing) {
    return (
      <Tag className="min-w-0">
        {editable ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title={`Bấm để đổi ${label}`}
            className={cn('block w-full text-left', className)}
          >
            {value}
          </button>
        ) : (
          <span className={cn('block', className)}>{value}</span>
        )}
      </Tag>
    );
  }

  return (
    <input
      autoFocus
      defaultValue={value}
      maxLength={maxLength}
      aria-label={`Đổi ${label}`}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          e.preventDefault(); // nằm trong modal (tên checklist) thì Esc chỉ huỷ sửa, không đóng modal
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
      onBlur={(e) => {
        const next = e.currentTarget.value.trim();
        if (!cancelled.current && next && next !== value) onSave(next);
        cancelled.current = false;
        setEditing(false);
      }}
      className={cn('min-w-0 rounded outline-none', inputClassName)}
    />
  );
}
