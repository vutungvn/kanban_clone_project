import type { BoardBackground } from '../boards/boards.constants';
import type { TemplateContent } from './template-content';

export interface BuiltinTemplate {
  /** Slug cố định — không đổi sau khi đã phát hành (client có thể đang giữ link) */
  id: string;
  title: string;
  description: string;
  /** Nhóm để lọc trên trang Mẫu */
  category: string;
  background: BoardBackground;
  content: TemplateContent;
}

/**
 * Mẫu có sẵn — ai cũng thấy, không sửa / xoá được. Sửa nội dung ở đây chỉ ảnh hưởng các bảng tạo sau đó.
 * Thẻ trỏ tới nhãn bằng vị trí trong mảng `labels`.
 */
export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: 'kanban-basic',
    title: 'Kanban cơ bản',
    description: 'Ba cột Cần làm → Đang làm → Hoàn thành. Phù hợp với mọi loại công việc.',
    category: 'Chung',
    background: 'blue',
    content: {
      labels: [
        { name: 'Gấp', color: 'red' },
        { name: 'Quan trọng', color: 'orange' },
        { name: 'Chờ phản hồi', color: 'yellow' },
      ],
      lists: [
        {
          title: 'Cần làm',
          cards: [
            {
              title: 'Bắt đầu từ đây 👋',
              description:
                'Mỗi thẻ là một việc cần làm. Kéo thẻ sang cột "Đang làm" khi bắt đầu, sang "Hoàn thành" khi xong.\n\n' +
                'Mở thẻ để thêm mô tả, nhãn, hạn chót, người được giao và checklist.',
              checklists: [
                {
                  title: 'Làm quen với bảng',
                  items: ['Đổi tên bảng cho phù hợp', 'Mời đồng đội vào bảng', 'Thêm thẻ đầu tiên của bạn', 'Xoá các thẻ hướng dẫn này'],
                },
              ],
            },
            { title: 'Việc cần làm tiếp theo', labels: [1] },
          ],
        },
        { title: 'Đang làm', cards: [{ title: 'Việc đang làm dở', labels: [0] }] },
        { title: 'Hoàn thành', cards: [] },
      ],
    },
  },
  {
    id: 'scrum',
    title: 'Scrum',
    description: 'Quản lý Product Backlog, Sprint và các nghi thức Scrum cho nhóm phát triển phần mềm.',
    category: 'Phát triển phần mềm',
    background: 'purple',
    content: {
      labels: [
        { name: 'Story', color: 'green' },
        { name: 'Bug', color: 'red' },
        { name: 'Task', color: 'blue' },
        { name: 'Spike', color: 'purple' },
      ],
      lists: [
        {
          title: 'Product Backlog',
          cards: [
            {
              title: 'Là người dùng, tôi muốn đăng nhập bằng email',
              labels: [0],
              description: 'Viết user story theo mẫu: "Là <vai trò>, tôi muốn <mục tiêu> để <lợi ích>".',
              checklists: [{ title: 'Tiêu chí chấp nhận', items: ['Đăng nhập đúng → vào trang chủ', 'Sai mật khẩu → báo lỗi rõ ràng', 'Có "Quên mật khẩu"'] }],
            },
            { title: 'Nghiên cứu thư viện biểu đồ', labels: [3] },
          ],
        },
        {
          title: 'Sprint Backlog',
          cards: [
            {
              title: 'Sprint Planning',
              coverColor: 'sky',
              description: 'Buổi lên kế hoạch đầu mỗi Sprint: chọn việc từ Product Backlog đưa vào Sprint Backlog.',
              checklists: [
                {
                  title: 'Chuẩn bị',
                  items: ['Product Owner sắp xếp ưu tiên Product Backlog', 'Ước lượng story point', 'Chốt mục tiêu Sprint', 'Chia nhỏ story thành task'],
                },
              ],
            },
          ],
        },
        { title: 'Đang làm', cards: [] },
        { title: 'Review', cards: [] },
        { title: 'Kiểm thử', cards: [{ title: 'Sửa lỗi hiển thị trên Safari', labels: [1] }] },
        {
          title: 'Hoàn thành',
          cards: [
            {
              title: 'Definition of Done',
              coverColor: 'green',
              description: 'Một việc chỉ được coi là xong khi đạt mọi tiêu chí dưới đây.',
              checklists: [
                {
                  title: 'Tiêu chí hoàn thành',
                  items: ['Code đã được review', 'Có unit test, CI xanh', 'Đã kiểm thử trên môi trường staging', 'Cập nhật tài liệu nếu cần'],
                },
              ],
            },
            {
              title: 'Sprint Retrospective',
              description: 'Cuối mỗi Sprint, cả nhóm nhìn lại cách làm việc để cải thiện Sprint sau.',
              checklists: [{ title: 'Thảo luận', items: ['Điều làm tốt', 'Điều cần cải thiện', 'Hành động cho Sprint sau'] }],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'project-management',
    title: 'Quản lý dự án',
    description: 'Theo dõi dự án từ ý tưởng, lên kế hoạch, thực hiện đến nghiệm thu.',
    category: 'Quản lý dự án',
    background: 'teal',
    content: {
      labels: [
        { name: 'Ưu tiên cao', color: 'red' },
        { name: 'Ưu tiên trung bình', color: 'yellow' },
        { name: 'Ưu tiên thấp', color: 'green' },
        { name: 'Rủi ro', color: 'purple' },
      ],
      lists: [
        { title: 'Ý tưởng', cards: [{ title: 'Ý tưởng tính năng mới', labels: [2] }] },
        {
          title: 'Kế hoạch',
          cards: [
            {
              title: 'Khởi động dự án',
              labels: [0],
              coverColor: 'blue',
              checklists: [
                {
                  title: 'Việc cần chốt',
                  items: ['Mục tiêu và phạm vi dự án', 'Các bên liên quan', 'Mốc thời gian chính', 'Ngân sách', 'Kênh trao đổi của nhóm'],
                },
              ],
            },
            { title: 'Đánh giá rủi ro', labels: [3], description: 'Liệt kê rủi ro, khả năng xảy ra, mức ảnh hưởng và cách xử lý.' },
          ],
        },
        { title: 'Đang thực hiện', cards: [{ title: 'Hạng mục đang triển khai', labels: [1] }] },
        { title: 'Chờ duyệt', cards: [] },
        { title: 'Hoàn thành', cards: [] },
      ],
    },
  },
  {
    id: 'bug-tracking',
    title: 'Theo dõi lỗi',
    description: 'Tiếp nhận, phân loại và xử lý lỗi phần mềm theo mức độ nghiêm trọng.',
    category: 'Phát triển phần mềm',
    background: 'sunset',
    content: {
      labels: [
        { name: 'Nghiêm trọng', color: 'red_bold' },
        { name: 'Cao', color: 'orange' },
        { name: 'Thấp', color: 'yellow_subtle' },
        { name: 'UI', color: 'sky' },
        { name: 'Backend', color: 'purple' },
      ],
      lists: [
        {
          title: 'Báo cáo mới',
          cards: [
            {
              title: '[Mẫu] Không lưu được hồ sơ khi đổi ảnh',
              labels: [1, 4],
              description:
                'Các bước tái hiện:\n1. ...\n2. ...\n\nKết quả mong đợi:\n...\n\nKết quả thực tế:\n...\n\nMôi trường: trình duyệt, hệ điều hành, phiên bản',
            },
          ],
        },
        { title: 'Đã xác nhận', cards: [{ title: 'Nút "Lưu" bị lệch trên điện thoại', labels: [2, 3] }] },
        {
          title: 'Đang sửa',
          cards: [
            {
              title: 'Trang thanh toán trả lỗi 500',
              labels: [0, 4],
              checklists: [{ title: 'Xử lý', items: ['Tái hiện được lỗi', 'Tìm nguyên nhân', 'Viết test cho lỗi', 'Sửa và review'] }],
            },
          ],
        },
        { title: 'Chờ kiểm thử', cards: [] },
        { title: 'Đã đóng', cards: [] },
      ],
    },
  },
  {
    id: 'weekly-planner',
    title: 'Kế hoạch tuần',
    description: 'Sắp xếp việc cá nhân trong tuần, tập trung vào việc của hôm nay.',
    category: 'Cá nhân',
    background: 'green',
    content: {
      labels: [
        { name: 'Công việc', color: 'blue' },
        { name: 'Cá nhân', color: 'pink' },
        { name: 'Học tập', color: 'lime' },
      ],
      lists: [
        {
          title: 'Tuần này',
          cards: [
            { title: 'Đọc xong một cuốn sách', labels: [2] },
            { title: 'Tập thể dục 3 buổi', labels: [1], checklists: [{ title: 'Buổi tập', items: ['Buổi 1', 'Buổi 2', 'Buổi 3'] }] },
          ],
        },
        {
          title: 'Hôm nay',
          cards: [
            {
              title: 'Lên kế hoạch cho ngày',
              labels: [0],
              description: 'Mỗi sáng kéo 3 việc quan trọng nhất từ "Tuần này" sang đây.',
            },
          ],
        },
        { title: 'Đang làm', cards: [] },
        { title: 'Xong', cards: [] },
      ],
    },
  },
  {
    id: 'recruiting',
    title: 'Tuyển dụng',
    description: 'Theo dõi ứng viên qua từng vòng: sàng lọc, phỏng vấn, đề nghị, nhận việc.',
    category: 'Nhân sự',
    background: 'dark',
    content: {
      labels: [
        { name: 'Frontend', color: 'sky' },
        { name: 'Backend', color: 'purple' },
        { name: 'Thực tập', color: 'lime' },
        { name: 'Tiềm năng', color: 'green_bold' },
      ],
      lists: [
        {
          title: 'Ứng viên mới',
          cards: [
            {
              title: 'Nguyễn Văn A — Frontend Developer',
              labels: [0],
              description: 'Nguồn: ...\nCV: (đính kèm vào thẻ)\nMức lương mong muốn: ...',
            },
          ],
        },
        {
          title: 'Sàng lọc CV',
          cards: [{ title: 'Tiêu chí sàng lọc', coverColor: 'yellow', checklists: [{ title: 'Kiểm tra', items: ['Kinh nghiệm phù hợp', 'Kỹ năng bắt buộc', 'Mức lương trong ngân sách'] }] }],
        },
        {
          title: 'Phỏng vấn',
          cards: [
            {
              title: 'Quy trình phỏng vấn',
              checklists: [{ title: 'Các vòng', items: ['Gọi điện sơ bộ', 'Bài kiểm tra kỹ thuật', 'Phỏng vấn chuyên môn', 'Phỏng vấn văn hoá'] }],
            },
          ],
        },
        { title: 'Đề nghị', cards: [] },
        { title: 'Đã nhận việc', cards: [] },
      ],
    },
  },
];

export const findBuiltinTemplate = (id: string) => BUILTIN_TEMPLATES.find((t) => t.id === id);
