# Kết quả kiểm thử

Môi trường đã chạy: **MacBook Pro 2017 (MacBookPro14,3), Intel Core i7 2,8 GHz 4 lõi, RAM 16 GB, macOS 13.7.6 (22H625), x86_64**, Node 24.15.0. Ngày kiểm thử: 11/10/2026.

| Mục | Kết quả | Bằng chứng / giới hạn |
| --- | --- | --- |
| Build TypeScript, Vite, Electron bundle | Passed | `npx tsc --noEmit`, `npm run build` |
| Canvas native trên darwin x64 | Passed | Binary Mach-O x86_64; `npm run doctor` đọc pixel RGBA 255,64,0,255 |
| FFmpeg native và libx264 | Passed | `npm run doctor` |
| Bot 100 seed × 180 giây | Passed | Seed 1–100, chế độ Chơi lâu, 100/100 sống đủ 180 giây; chạy headless |
| Va chạm, restart, pause | Passed | `npm test` |
| Video mẫu 60 frame | Passed | Worker export + ffprobe: H.264, 1080 × 1920, yuv420p, SAR 1:1, 60/1 fps, 60 frame, 1.000 giây; 60/60 frame khác nhau |
| Writer độc lập renderer | Passed | `npm run smoke:workers`: 134 frame / 2,233 giây, đọc lại đủ chunk gzip |
| Gói `.app` Mac Intel | Passed | `npm run pack:mac`; mở `release/mac/Flappy Auto Recorder.app` trực tiếp trên máy này, trang React và IPC hiển thị; gói khoảng 468 MB, không chứa thư mục build lặp. Bản chưa ký/notarize. |
| Chẩn đoán trong `.app` | Passed | Nút chẩn đoán trong bản release chạy Canvas native RGBA 255,64,0,255, FFmpeg có `libx264`, ffprobe chạy; binary x86_64 nằm trong `Contents/Resources/bin`, Canvas x64 ở `app.asar.unpacked`. |
| A01 và preview | Passed | `.app` thật: canvas A có CSS width 338,625 px / height 602 px = 0,5625; backing 678 × 1204 ở Retina. Preview khi cửa sổ hiển thị: 60 fps, p95 18 ms trong phép đo 120 frame; main/worker RSS tại thời điểm đo 129 MB. |
| A02 thao tác nhanh và dừng/tiếp tục | Passed | Hai lệnh quay gần đồng thời: một thành công, một bị từ chối; chỉ một phiên. Dừng chơi chốt phiên, trạng thái `paused`; tiếp tục trở lại `running`. |
| Lệnh chạy từ nguồn | Passed | `npm run build` rồi `npm start` nạp giao diện từ file local; `npm run dev` phục vụ đúng ứng dụng bằng Vite cổng 5180 và mở Electron. Sau lần cài đầu, runtime không cần tải tài nguyên mạng. |
| Quay khi thu nhỏ 2 phút | Passed | `.app` thật: thu nhỏ 120 giây, frame tăng từ 128 lên 7338; phiên chốt 7362 frame / 122,7 giây, 21 chunk. Đọc lại: không thiếu frame, mọi bước thời gian đúng 1/60 giây, 7361/7361 cặp frame liên tiếp có chuyển động. |
| Xuất phiên cũ khi phiên mới đang quay | Passed | Xuất phiên cũ 328 frame từ bản ghi thật trong khi phiên 2 phút vẫn chạy; ffprobe xác nhận 1080 × 1920 60 fps, 328 frame / 5,467 giây; 328 frame khác nhau. |
| Lịch sau restart, cửa sổ thu nhỏ | Passed | Lịch lưu UTC, kill rồi mở lại app trước giờ; app tự chạy và quay khi cửa sổ thu nhỏ. Sau khi sửa giới hạn frame, lịch thử 5 giây bắt đầu trễ 52 ms, chốt đúng **300 frame / 5,000 giây**, không có frame/time gap. |
| MP4 từ phiên lịch thực | Passed | Xuất 300 snapshot của lịch thử bằng export worker; ffprobe: H.264, 1080 × 1920, yuv420p, SAR 1:1, 60/1 fps, 300 frame / 5,000 giây; 300 frame khác nhau. |
| Hủy export | Passed | Hủy worker khi đang dựng phiên 7362 frame: trạng thái `cancelled`, không để file đích hoặc `.part.mp4`, metadata và 7362 snapshot giữ nguyên. |
| Phục hồi sau crash | Passed | Dữ liệu thử có một chunk đã rename nhưng metadata chưa cập nhật và một gzip `.part` thiếu footer: app cứu đủ 370 frame (360 + 10), timeline không gap. Phiên `interrupted` xuất lại được MP4 H.264 1080 × 1920/60 fps, 370 frame khác nhau. |
| Xung đột lịch và quay thủ công | Passed | Khi lịch tới giờ trong phiên thủ công, lịch thành `missed` với lý do trùng phiên; phiên thủ công vẫn chạy và chốt riêng. |
| Lịch quá giờ khi app tắt | Passed | Một lịch `pending` quá hạn trong dữ liệu thử được đánh dấu `missed` khi mở lại, với thông báo app không chạy. |
| Quay 30 phút, memory peak | Not tested | Chưa chạy phiên 30 phút; chưa có kết quả peak memory trên phiên dài. |
| Windows x64 | Not tested | Cần đóng gói trên Windows |

Các mục `Not tested` chưa được coi là đạt nghiệm thu. Chưa chạy A06 đủ 5 phút với chuyển ứng dụng trong 3 phút, A12 phiên 30 phút, A14 lỗi hết dung lượng/FFmpeg, A15 hộp thoại lưu thực tế, A17 ngắt mạng và Windows. Phép đo 129 MB chỉ là một thời điểm, không phải peak của phiên dài. Có thể dùng `npm run smoke:video` để tái tạo kiểm tra MP4 ngắn.
