'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

const COLORS = ['bg-brand', 'bg-success', 'bg-purple-600', 'bg-rose-600', 'bg-amber-600', 'bg-teal-600'];

function colorFor(seed: string) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

/** "Nguyễn Văn An" → "NA", "An" → "AN" */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2);
  return letters.toUpperCase();
}

/** Tên gọi kiểu Việt: chữ cuối của họ tên ("Nguyễn Văn An" → "An") */
export function givenName(name: string) {
  return name.trim().split(/\s+/).pop() ?? name;
}

/** Ảnh đại diện; chưa có ảnh (hoặc ảnh lỗi) thì hiện chữ cái đầu trên nền màu. */
export function Avatar({
  name,
  seed,
  src,
  size = 32,
  className,
}: {
  name: string;
  /** Dùng id user để màu cố định kể cả khi đổi tên */
  seed?: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (src && failed !== src) {
    return (
      <img
        src={src}
        alt={name}
        title={name}
        width={size}
        height={size}
        draggable={false}
        onError={() => setFailed(src)}
        style={{ width: size, height: size }}
        className={cn('inline-block shrink-0 rounded-full bg-surface-mid object-cover', className)}
      />
    );
  }
  return (
    <span
      title={name}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.4)) }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none',
        colorFor(seed ?? name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
