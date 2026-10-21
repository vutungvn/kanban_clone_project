'use client';

import { useEffect } from 'react';
import { toast } from '@/components/toast';
import { emitCardEvent, getSocket, type BoardEvent } from './realtime';
import type { BoardActions } from './use-board';

/**
 * Theo dõi thay đổi của 1 bảng do người khác (hoặc tab khác) thực hiện:
 * - `board:changed` → tải lại bảng ngầm (useBoard tự hoãn nếu đang có thao tác dở / đang kéo thả)
 * - `board:deleted` / `board:removed` → tải lại → màn "Không tìm thấy bảng"
 * Mất kết nối rồi nối lại → vào lại phòng và tải lại để không sót thay đổi.
 */
export function useBoardRealtime(boardId: string, actions: BoardActions) {
  useEffect(() => {
    const socket = getSocket();
    let reconnect = false;

    const join = () => {
      socket.emit('board:join', boardId);
      // Lần kết nối đầu: bảng vừa tải xong. Kết nối lại sau khi rớt mạng: có thể đã bỏ lỡ thay đổi.
      if (reconnect) actions.remoteChanged();
      reconnect = true;
    };
    const onChanged = (event: BoardEvent) => {
      if (event.boardId !== boardId) return;
      actions.remoteChanged();
      if (event.cardId) emitCardEvent(event);
    };
    const onDeleted = (event: BoardEvent) => {
      if (event.boardId !== boardId) return;
      toast.error('Bảng này vừa bị xoá');
      actions.resync();
    };
    const onRemoved = (event: BoardEvent) => {
      if (event.boardId !== boardId) return;
      toast.error('Bạn không còn là thành viên của bảng này');
      actions.resync();
    };

    if (socket.connected) join();
    socket.on('connect', join);
    socket.on('board:changed', onChanged);
    socket.on('board:deleted', onDeleted);
    socket.on('board:removed', onRemoved);
    return () => {
      socket.emit('board:leave', boardId);
      socket.off('connect', join);
      socket.off('board:changed', onChanged);
      socket.off('board:deleted', onDeleted);
      socket.off('board:removed', onRemoved);
    };
  }, [boardId, actions]);
}
