# Chạy trên Windows x64

Trên Windows x64, cài Node.js 22 trở lên rồi trong thư mục dự án chạy:

```powershell
npm ci
npm run doctor
npm run dev
```

Đóng gói bằng `npm run pack:win`. FFmpeg và ffprobe của Windows được chép vào `resources/bin/` lúc build trên Windows. Chim tự chơi, bản ghi vẫn tiếp tục khi thu nhỏ ứng dụng, nhưng lịch cần ứng dụng đang chạy và máy không ngủ. Bản Windows chưa được đóng gói hoặc kiểm thử trong phiên phát triển này.
