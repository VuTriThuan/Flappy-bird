# Flappy Auto Recorder

Ứng dụng Electron local cho macOS Intel và Windows x64. Chim tự chơi; bạn chỉ xem, quay màn hình A 9:16, rồi xuất MP4 dọc 1080 × 1920 ở 60 fps. Dữ liệu quay là snapshot của game, nên thu nhỏ hoặc che cửa sổ không làm phiên quay phụ thuộc vào màn hình hệ điều hành.

## Cài và chạy

Yêu cầu Node.js 22 trở lên để build, npm và khoảng trống đĩa cho bản ghi/video. Máy mục tiêu là Mac Intel macOS 13.7.6. `npm ci` tải sẵn Electron và FFmpeg ở lần cài đầu; sau đó ứng dụng chạy offline.

```sh
npm ci
npm run doctor
npm run dev
```

Để build và mở bản production chưa đóng gói:

```sh
npm run build
npm start
```

Đóng gói trên Mac Intel:

```sh
npm run pack:mac
```

Bản `.app` ở `release/mac/Flappy Auto Recorder.app`. Đóng gói trên Windows x64 bằng `npm run pack:win` trên chính Windows. Các binary FFmpeg/ffprobe của nền tảng hiện tại được chép vào gói khi build.

## Kiểm thử

```sh
npm test
npm run bot:benchmark
npm run smoke:video
npm run smoke:workers
```

`smoke:video` tạo một MP4 mẫu 1 giây từ 60 snapshot engine, xuất qua worker/FFmpeg và kiểm tra ffprobe. File mẫu nằm trong thư mục tạm được in ra màn hình.
`smoke:workers` quay trực tiếp bằng simulation worker và writer hơn 2 giây rồi đọc lại mọi snapshot. Có thể kiểm tra phiên đã lưu bằng `node scripts/verify-recording.mjs <thư-mục-phiên>`.
Video mẫu từ một lịch quay thật nằm ở [`samples/Flappy-demo-1080x1920-60fps.mp4`](samples/Flappy-demo-1080x1920-60fps.mp4).

Xem [hướng dẫn Mac](docs/RUN_MACOS.md), [hướng dẫn Windows](docs/RUN_WINDOWS.md), [kiến trúc](docs/ARCHITECTURE.md) và [kết quả kiểm thử](docs/TEST_RESULTS.md).
# Flappy-bird
