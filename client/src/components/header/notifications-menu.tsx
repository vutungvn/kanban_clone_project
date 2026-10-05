'use client';

import { Bell } from 'lucide-react';
import { Popover, PopoverHeader, usePopoverAnchor } from '@/components/popover';
import { HEADER_ICON_BUTTON } from './styles';

export function NotificationsMenu() {
  const { anchor, toggle, close } = usePopoverAnchor();

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label="Thông báo"
        title="Thông báo"
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        className={HEADER_ICON_BUTTON}
      >
        <Bell size={20} />
      </button>

      <Popover anchor={anchor} onClose={close} label="Thông báo" align="end" width={360}>
        <PopoverHeader title="Thông báo" onClose={close} />
        {/* Chưa có backend thông báo → luôn hiện trạng thái trống */}
        <div className="flex flex-col items-center px-4 pt-4 pb-6 text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface-mid text-brand">
            <Bell size={26} />
          </span>
          <p className="text-sm font-semibold">Không có thông báo nào</p>
          <p className="mt-1 text-xs text-ink-subtle">
            Bạn sẽ nhận thông báo khi có người nhắc tới bạn hoặc giao thẻ cho bạn.
          </p>
        </div>
      </Popover>
    </>
  );
}
