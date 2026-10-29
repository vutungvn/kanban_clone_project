import { useEffect, useState } from 'react';
import { errorMessage } from './api';
import { searchApi, type SearchParams, type SearchResponse } from './search';

export interface SearchState {
  /** Kết quả gần nhất — giữ nguyên trong lúc đang tải lần mới để danh sách không nhấp nháy */
  data: SearchResponse | null;
  /** `JSON.stringify(params)` ứng với `data` — so với params hiện tại để biết kết quả đã cũ chưa */
  dataKey: string | null;
  loading: boolean;
  error: string | null;
}

const IDLE: SearchState = { data: null, dataKey: null, loading: false, error: null };

/**
 * Tìm thẻ / bình luận trên server khi `params` đổi: chờ `debounceMs` sau lần gõ cuối,
 * huỷ request cũ (gõ tiếp thì kết quả cũ không đè lên kết quả mới). `params` = null → không tìm.
 */
export function useSearchResults(params: SearchParams | null, debounceMs = 250) {
  const [state, setState] = useState<SearchState>(IDLE);
  const key = params ? JSON.stringify(params) : null;

  useEffect(() => {
    if (!key) {
      setState(IDLE);
      return;
    }
    const current = JSON.parse(key) as SearchParams;
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    const timer = setTimeout(() => {
      searchApi.search(current, controller.signal).then(
        (data) => setState({ data, dataKey: key, loading: false, error: null }),
        (e) => {
          if (!controller.signal.aborted) setState({ ...IDLE, error: errorMessage(e) });
        },
      );
    }, debounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, debounceMs]);

  return state;
}
