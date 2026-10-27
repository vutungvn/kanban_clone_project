'use client';

import { Check } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Avatar } from '@/components/avatar';
import { PopoverHeader } from '@/components/popover';
import type { BoardDetail, Card } from '@/lib/boards-api';
import { cn } from '@/lib/cn';
import { matchesQuery } from '@/lib/search';
import type { BoardActions } from '@/lib/use-board';
import { POPOVER_SECTION, TEXT_INPUT } from './card-ui';

/** Popover "Thành viên" của thẻ: bấm để giao / bỏ giao. Chỉ giao được cho thành viên của bảng. */
export function MembersPopoverContent({
  board,
  card,
  actions,
  onClose,
}: {
  board: BoardDetail;
  card: Card;
  actions: BoardActions;
  onClose: () => void;
}) {
  const meId = useAuth().user?.id;
  const [query, setQuery] = useState('');
  const shown = board.members.filter((m) => matchesQuery(`${m.name} ${m.email}`, query));
  const assigned = shown.filter((m) => card.memberIds.includes(m.id));
  const others = shown.filter((m) => !card.memberIds.includes(m.id));

  const group = (title: string, members: typeof shown) =>
    members.length > 0 && (
      <>
        <h3 className={POPOVER_SECTION}>{title}</h3>
        <ul className="-mx-1 flex flex-col">
          {members.map((m) => {
            const on = card.memberIds.includes(m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => void actions.setCardMember(card.id, m.id, !on)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded px-1.5 py-1.5 text-left text-sm transition-colors hover:bg-surface-low',
                  )}
                >
                  <Avatar name={m.name} seed={m.id} src={m.avatarUrl} size={28} />
                  <span className="min-w-0 flex-1 truncate">
                    {m.name}
                    {m.id === meId && <span className="ml-1 text-xs text-ink-subtle">(bạn)</span>}
                  </span>
                  {on && <Check size={16} className="shrink-0 text-brand" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </>
    );

  return (
    <>
      <PopoverHeader title="Thành viên" onClose={onClose} />
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tìm thành viên..."
        aria-label="Tìm thành viên"
        className={TEXT_INPUT}
      />
      <div className="max-h-80 overflow-y-auto">
        {group('Thành viên của thẻ', assigned)}
        {group('Thành viên của bảng', others)}
        {shown.length === 0 && <p className="px-1 pt-3 text-sm text-ink-subtle">Không tìm thấy thành viên phù hợp.</p>}
      </div>
    </>
  );
}
