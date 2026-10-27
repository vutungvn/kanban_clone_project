import type { ReactNode } from 'react';
import type { Activity } from '@/lib/boards-api';
import { formatDay, formatDayTime } from '@/lib/card-dates';
import { LabelChip } from './card-ui';

const str = (value: unknown) => (typeof value === 'string' ? value : '');
const quote = (value: unknown) => <strong className="font-medium">{str(value)}</strong>;

/**
 * Câu mô tả hoạt động (sau tên người thực hiện) — dùng trong modal thẻ và trang Hoạt động.
 * `members`: thành viên bảng để hiện tên mới nhất; người đã rời bảng thì dùng tên đã chụp lại lúc đó.
 */
export function describeActivity(activity: Activity, members: { id: string; name: string }[]): ReactNode {
  const d = activity.data;
  const label = () => <LabelChip label={{ name: str(d.name), color: str(d.color) }} size="xs" className="mx-0.5" />;
  const isSelf = d.userId === activity.user?.id;
  // Thành viên đã rời bảng vẫn hiện tên đã chụp lại lúc đó
  const memberName = () => quote(members.find((m) => m.id === d.userId)?.name ?? d.name);

  switch (activity.type) {
    case 'CARD_CREATED':
      return <>đã thêm thẻ này vào danh sách {quote(d.listTitle)}</>;
    case 'CARD_RENAMED':
      return (
        <>
          đã đổi tên thẻ từ {quote(d.from)} thành {quote(d.to)}
        </>
      );
    case 'CARD_MOVED':
      return (
        <>
          đã chuyển thẻ này từ {quote(d.fromList)} sang {quote(d.toList)}
        </>
      );
    case 'LABEL_ADDED':
      return <>đã thêm nhãn {label()} vào thẻ này</>;
    case 'LABEL_REMOVED':
      return <>đã gỡ nhãn {label()} khỏi thẻ này</>;
    case 'MEMBER_ADDED':
      return isSelf ? <>đã tham gia thẻ này</> : <>đã thêm {memberName()} vào thẻ này</>;
    case 'MEMBER_REMOVED':
      return isSelf ? <>đã rời khỏi thẻ này</> : <>đã gỡ {memberName()} khỏi thẻ này</>;
    case 'DATES_CHANGED': {
      const start = typeof d.startDate === 'string' ? d.startDate : null;
      const due = typeof d.dueDate === 'string' ? d.dueDate : null;
      if (start && due) return <>đã đặt ngày của thẻ: {quote(`${formatDay(start)} - ${formatDayTime(due)}`)}</>;
      if (due) return <>đã đặt hạn chót là {quote(formatDayTime(due))}</>;
      if (start) return <>đã đặt ngày bắt đầu là {quote(formatDay(start))}</>;
      return <>đã gỡ ngày của thẻ này</>;
    }
    case 'DUE_COMPLETE_CHANGED':
      return d.complete ? <>đã đánh dấu hạn chót là hoàn thành</> : <>đã đánh dấu hạn chót là chưa hoàn thành</>;
    case 'CHECKLIST_ADDED':
      return <>đã thêm checklist {quote(d.title)} vào thẻ này</>;
    case 'CHECKLIST_REMOVED':
      return <>đã xoá checklist {quote(d.title)} khỏi thẻ này</>;
    case 'CHECKLIST_ITEM_COMPLETED':
      return (
        <>
          đã hoàn thành {quote(d.title)} trong {quote(d.checklist)}
        </>
      );
    case 'CHECKLIST_ITEM_UNCOMPLETED':
      return (
        <>
          đã đánh dấu {quote(d.title)} là chưa hoàn thành trong {quote(d.checklist)}
        </>
      );
    case 'CARD_ARCHIVED':
      return <>đã lưu trữ thẻ này</>;
    case 'CARD_RESTORED':
      return <>đã khôi phục thẻ này</>;
    case 'CARD_COPIED':
      return d.fromBoard ? (
        <>
          đã sao chép thẻ này từ {quote(d.sourceTitle)} (bảng {quote(d.fromBoard)}) vào danh sách {quote(d.listTitle)}
        </>
      ) : (
        <>
          đã sao chép thẻ này từ {quote(d.sourceTitle)} vào danh sách {quote(d.listTitle)}
        </>
      );
    case 'ATTACHMENT_ADDED':
      return <>đã đính kèm tệp {quote(d.name)} vào thẻ này</>;
    case 'ATTACHMENT_REMOVED':
      return <>đã xoá tệp đính kèm {quote(d.name)} khỏi thẻ này</>;
    case 'CARD_TRANSFERRED':
      return (
        <>
          đã chuyển thẻ này từ bảng {quote(d.fromBoard)} sang bảng {quote(d.toBoard)}
        </>
      );
    default:
      return <>đã cập nhật thẻ này</>;
  }
}
