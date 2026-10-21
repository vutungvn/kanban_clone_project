'use client';

import { useId, useRef, useState, type KeyboardEvent, type RefObject, type TextareaHTMLAttributes } from 'react';
import { Avatar } from '@/components/avatar';
import { cn } from '@/lib/cn';
import { matchMembers, mentionQuery, type MentionMember } from '@/lib/mentions';

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  /** Thành viên có thể nhắc tên (thường là thành viên bảng, trừ chính mình) */
  members: MentionMember[];
  inputRef?: RefObject<HTMLTextAreaElement | null>;
};

/**
 * Ô nhập có gợi ý nhắc tên: gõ `@` → danh sách thành viên ngay dưới ô.
 * ↑ / ↓ chọn, Enter / Tab chèn "@Họ Tên ", Esc đóng gợi ý (không đóng ô nhập / modal).
 * Khi danh sách đang mở, các phím trên không chuyển xuống `onKeyDown` của nơi dùng.
 */
export function MentionTextarea({ value, onValueChange, members, inputRef, onKeyDown, onBlur, ...props }: Props) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef ?? localRef;
  const listId = useId();
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const options = mention ? matchMembers(members, mention.query) : [];
  const open = options.length > 0;
  const activeIndex = Math.min(active, options.length - 1);

  /** Đọc lại phần `@...` trước con trỏ sau mỗi lần gõ / di chuyển con trỏ. */
  function sync(el: HTMLTextAreaElement) {
    const next = el.selectionStart === el.selectionEnd ? mentionQuery(el.value, el.selectionStart) : null;
    if (next?.start === mention?.start && next?.query === mention?.query) return;
    setMention(next);
    setActive(0);
  }

  function pick(member: MentionMember) {
    const el = ref.current;
    if (!el || !mention) return;
    const insert = `@${member.name} `;
    const caret = el.selectionStart;
    onValueChange(value.slice(0, mention.start) + insert + value.slice(caret));
    setMention(null);
    const position = mention.start + insert.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(position, position);
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (open && !e.nativeEvent.isComposing) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setActive((activeIndex + step + options.length) % options.length);
        return;
      }
      if ((e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) || e.key === 'Tab') {
        e.preventDefault();
        pick(options[activeIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault(); // modal / ô nhập không coi đây là "huỷ"
        setMention(null);
        return;
      }
    }
    onKeyDown?.(e);
  }

  return (
    <div className="relative">
      <textarea
        {...props}
        ref={ref}
        value={value}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        onChange={(e) => {
          onValueChange(e.target.value);
          sync(e.target);
        }}
        onSelect={(e) => sync(e.currentTarget)}
        onKeyDown={handleKeyDown}
        onBlur={(e) => {
          setMention(null);
          onBlur?.(e);
        }}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Nhắc tên thành viên"
          className="absolute top-full left-0 z-20 mt-1 w-64 rounded-lg bg-white p-1 shadow-[0_8px_24px_rgba(9,30,66,0.2),0_0_1px_rgba(9,30,66,0.31)]"
        >
          {options.map((m, i) => (
            <li
              key={m.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              // Giữ focus ở ô nhập (không blur trước khi chọn)
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(m)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm',
                i === activeIndex ? 'bg-surface-mid text-ink' : 'text-ink',
              )}
            >
              <Avatar name={m.name} seed={m.id} size={24} />
              <span className="min-w-0 flex-1 truncate">{m.name}</span>
            </li>
          ))}
          <li role="presentation" className="px-2 pt-1 pb-0.5 text-[11px] text-ink-subtle">
            ↑ ↓ để chọn · Enter để chèn · Esc để đóng
          </li>
        </ul>
      )}
    </div>
  );
}
