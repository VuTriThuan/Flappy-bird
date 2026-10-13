# Kiến trúc

- `electron/main.ts`: main process, IPC có danh sách lệnh cố định, quản lý lịch, power blocker, vòng đời phiên và export.
- `electron/workers/simulation.ts`: đồng hồ đơn điệu, physics 120 Hz, snapshot 60 Hz, không dùng DOM hay thời gian `requestAnimationFrame` của renderer.
- `electron/workers/writer.ts`: nhận snapshot qua `MessagePort`, queue giới hạn bằng ACK, gzip 360 frame/chunk, metadata ghi nguyên tử.
- `electron/workers/export.ts`: đọc từng chunk, vẽ ở 1080 × 1920 bằng cùng hàm `drawScene` của preview, stream RGBA có backpressure vào FFmpeg, xác minh bằng ffprobe rồi rename file tạm.
- `src/main.tsx`: giao diện React; Canvas preview vẽ qua ref. Điều khiển và lịch nằm ngoài màn hình A.

Simulation worker là nguồn dữ liệu duy nhất. Snapshot chứa toàn bộ vị trí, pha game, điểm, seed, chế độ và đồng hồ hiệu ứng. Export không replay seed. Lịch được lưu với thời điểm UTC; main process dùng đồng hồ đơn điệu để theo dõi lịch đang chạy và cấu hình giới hạn frame cho worker (thời lượng giây × 60), nên bản ghi chốt đúng frame boundary. Nếu lịch đến hạn khi đang quay thủ công, lịch chuyển sang `missed` với lý do; phiên thủ công tiếp tục.

Power blocker dùng `prevent-app-suspension` khi game chạy, phiên quay hoặc export hoạt động, hoặc còn lịch chờ. Ngủ máy đánh dấu phiên gián đoạn. Đây là bản local, không dùng screen capture hay dịch vụ mạng khi vận hành.
