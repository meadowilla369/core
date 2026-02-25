# Git Workflow Rule

## Mục tiêu

Thiết lập quy tắc làm việc Git nhất quán cho dự án.

## Quy tắc bắt buộc

1. Luôn làm việc trên nhánh `dev`.
2. Mỗi khi hoàn thành một đầu công việc, phải tạo một commit riêng cho đầu việc đó.
3. Chỉ khi hoàn thành toàn bộ công việc trong phạm vi kế hoạch mới được merge và đẩy lên `main`.

## Quy trình chuẩn

1. Tạo và chuyển sang nhánh `dev` (nếu chưa có).
2. Thực hiện từng đầu việc theo checklist.
3. Sau mỗi đầu việc hoàn tất:
   - Kiểm tra thay đổi.
   - Commit ngay với message rõ ràng.
4. Khi tất cả đầu việc đã hoàn thành:
   - Rebase/merge cập nhật mới nhất.
   - Chạy lại kiểm tra tổng thể.
   - Merge `dev` vào `main`.
   - Push `main`.

## Ví dụ lệnh

```bash
# tạo nhánh dev (chỉ cần 1 lần)
git checkout -b dev

# làm việc hằng ngày
git checkout dev

# sau khi xong một đầu việc
git add .
git commit -m "feat(scope): complete <work-item>"

# sau khi xong toàn bộ
git checkout main
git merge dev
git push origin main
```
