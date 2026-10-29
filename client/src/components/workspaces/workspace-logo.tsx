import { cn } from '@/lib/cn';

const COLORS = ['bg-success', 'bg-brand', 'bg-purple-600', 'bg-rose-600', 'bg-amber-600', 'bg-teal-600', 'bg-indigo-600'];

function colorFor(seed: string) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

/** Logo không gian: chữ cái đầu của tên ("Không gian của An" → "A") trên nền màu theo id. */
export function WorkspaceLogo({ workspace, size = 24, className }: { workspace: { id: string; name: string }; size?: number; className?: string }) {
  // "Không gian của An" → lấy chữ cuối cho dễ phân biệt các không gian cá nhân
  const words = workspace.name.trim().split(/\s+/);
  const letter = (workspace.name.startsWith('Không gian của ') ? words[words.length - 1] : words[0])?.charAt(0) ?? '?';
  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 items-center justify-center rounded font-bold text-white select-none', colorFor(workspace.id), className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
    >
      {letter.toUpperCase()}
    </span>
  );
}
