import { Logo } from './logo';

export function AuthHeader({ subtitle }: { subtitle: string }) {
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      <Logo size={48} className="mb-3 shadow-sm" />
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Kanban</h1>
      <p className="mt-1 text-sm text-ink-subtle">{subtitle}</p>
    </div>
  );
}
