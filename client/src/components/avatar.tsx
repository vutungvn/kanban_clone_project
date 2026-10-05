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

export function Avatar({
  name,
  seed,
  size = 32,
  className,
}: {
  name: string;
  /** Dùng id user để màu cố định kể cả khi đổi tên */
  seed?: string;
  size?: number;
  className?: string;
}) {
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
