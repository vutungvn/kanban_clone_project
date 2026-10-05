import { SquareKanban } from 'lucide-react';

const DECOR_SHADOW = 'shadow-[0_8px_24px_-4px_rgba(9,30,66,0.06)]';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-surface">
      {/* Nền: gradient + các "thẻ" mờ trang trí */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-linear-to-br from-surface via-surface-low to-surface-highest opacity-90"
      />
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className={`absolute -top-12 -left-8 h-80 w-72 rotate-6 rounded-lg bg-surface-mid/60 backdrop-blur-2xl ${DECOR_SHADOW}`} />
        <div className={`absolute top-1/4 -right-16 h-96 w-80 -rotate-12 rounded-lg bg-surface-high/50 backdrop-blur-2xl ${DECOR_SHADOW}`} />
        <div className={`absolute -bottom-20 left-1/4 h-72 w-64 rotate-3 rounded-lg bg-surface-highest/40 backdrop-blur-xl ${DECOR_SHADOW}`} />
      </div>

      <main className="relative flex min-h-screen flex-col items-center justify-center px-4 py-6">
        <div className="w-full max-w-105">
          <div className="rounded-lg bg-white p-6 shadow-[0_12px_36px_-6px_rgba(9,30,66,0.18),0_0_1px_rgba(9,30,66,0.25)] sm:p-8">
            {children}
          </div>
          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-subtle/80">
            <SquareKanban size={16} className="text-brand" />
            Hệ thống bảng công việc linh hoạt &amp; bảo mật
          </p>
        </div>
      </main>
    </div>
  );
}
