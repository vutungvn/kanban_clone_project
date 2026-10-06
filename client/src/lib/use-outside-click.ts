import { useEffect, useRef, type RefObject } from 'react';

/** Gọi `handler` khi bấm chuột/chạm ra ngoài phần tử `ref`. */
export function useOutsideClick(ref: RefObject<HTMLElement | null>, handler: () => void, enabled = true) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) handlerRef.current();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [ref, enabled]);
}
