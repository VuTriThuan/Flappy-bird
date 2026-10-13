# Hướng dẫn chạy trên macOS Intel

1. Cài Node.js 22 trở lên. Trong thư mục dự án chạy `npm ci`, rồi `npm run doctor`. Lệnh doctor phải báo `darwin/x64`, Canvas RGBA và encoder `libx264`.
2. Chạy `npm run dev` để mở ứng dụng; hoặc `npm run pack:mac` rồi mở `release/mac/Flappy Auto Recorder.app`. Bản đóng gói chưa ký/notarize; nếu Gatekeeper chặn, dùng **Open** từ menu chuột phải theo hướng dẫn của macOS.
3. Nhấn **Bắt đầu chơi game** hoặc **Quay màn hình**. Chim tự chơi, không cần bấm phím. Chọn **Dừng quay** để chốt phiên mà game vẫn chạy. **Dừng chơi** chốt phiên đang quay.
4. Chọn **Xuất video** ở phiên muốn xuất. Chọn đường dẫn lưu trong hộp thoại, rồi chờ thanh tiến độ. Hủy hộp thoại không xóa phiên. Video chỉ chứa màn hình A, không chứa các nút bên cạnh.
5. Đặt lịch bằng ngày giờ địa phương và phút/giây. Ứng dụng cần đang chạy khi tới giờ. Thu nhỏ hoặc chuyển sang ứng dụng khác vẫn quay. Trên macOS, đóng cửa sổ giữ main process chạy; mở lại bằng Dock. Chọn Quit thì phiên hiện tại được chốt là gián đoạn và lịch không chạy cho tới lần mở sau. Máy ngủ, gập nắp hoặc tắt nguồn không nằm trong bảo đảm quay nền.

Phiên quay và lịch nằm trong `~/Library/Application Support/flappy-auto-recorder/` (thư mục `userData` của Electron). Mỗi phiên có `metadata.json` và các chunk `ndjson.gz`. Video MP4 lưu ở đường dẫn bạn chọn. Không xóa thư mục dữ liệu nếu còn phiên muốn xuất lại.

Nếu báo lỗi FFmpeg hoặc Canvas, mở **Chẩn đoán → Kiểm tra Canvas & FFmpeg** ngay trong app; khi chạy từ mã nguồn có thể dùng thêm `npm run doctor`. Bản đóng gói đặt FFmpeg/ffprobe tại `Contents/Resources/bin/` và native Canvas trong `app.asar.unpacked`. Nếu hết dung lượng, giải phóng chỗ trống rồi xuất lại phiên đã chốt. Phiên không hoàn tất sau crash vẫn giữ các chunk hoàn chỉnh; file `.part` được giữ để chẩn đoán.
