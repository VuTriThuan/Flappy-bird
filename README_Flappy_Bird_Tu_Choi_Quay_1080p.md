# Đặc tả để Codex xây game Flappy Bird tự chơi và quay video dọc 1080p

Tài liệu này là yêu cầu triển khai. Hãy xây ứng dụng hoàn chỉnh theo tài liệu, không chỉ trả lời bằng kế hoạch hoặc mã minh họa. Người dùng chỉ xem máy chơi. Chưa có mã nguồn game đi kèm tài liệu này.

## 1. Kết quả cần bàn giao

Xây một ứng dụng chạy local trên máy tính, có màn hình game dọc 9:16 gọi là **màn hình A**. Máy tự điều khiển chim bay qua các cặp ống. Phía ngoài màn hình A có các nút điều khiển chơi, quay, xuất video và đặt lịch quay.

Video chỉ chứa màn hình A, xuất **MP4, 1080 × 1920, 60 fps**. Khi chuyển sang ứng dụng khác, cửa sổ game bị che hoặc thu nhỏ, máy vẫn chơi và phiên quay vẫn tiếp tục. Game và video phải có chuyển động mượt.

Ưu tiên máy của người dùng: MacBook Pro 2017, Intel x86_64, macOS 13.7.6. Thiết kế có thể đóng gói cho Windows x64. Không cần tài khoản, API AI, máy chủ, cơ sở dữ liệu hoặc dịch vụ trả phí để chạy game. Cài các phụ thuộc một lần; ứng dụng hoàn chỉnh phải chạy offline.

## 2. Quyết định kiến trúc bắt buộc

Chọn **Electron + TypeScript + giao diện React/Vite + Canvas 2D**, kết hợp **Node.js worker** cho mô phỏng và **FFmpeg native** cho xuất video. React chỉ quản lý giao diện, không cập nhật toàn bộ cây component theo từng frame.

Không triển khai bản chính bằng một tab web thuần. Không coi `requestAnimationFrame`, `setInterval` trong tab ẩn hoặc `canvas.captureStream()` là bảo đảm cho quay nền. Không chỉ thêm `backgroundThrottling: false` rồi tuyên bố đã đáp ứng yêu cầu.

**Cơ chế ghi hình chính: ghi lại đầy đủ trạng thái hình ảnh của game theo timeline, rồi dựng từng frame khi xuất video.** Đây là bản ghi màn hình A ở cấp engine. Không chụp desktop, không chụp cửa sổ đang có focus, không dùng tọa độ vùng màn hình hệ điều hành. Vì vậy bản quay không lẫn cửa sổ khác và không phụ thuộc màn hình A có đang nhìn thấy hay không.

Người dùng thao tác như một công cụ quay thông thường: nhấn quay, game tiếp tục chơi, nhấn dừng hoặc xuất, nhận video. Trong lúc quay, ghi dữ liệu hình ảnh có thể tái dựng xuống đĩa. Khi xuất, dựng toàn bộ frame 1080 × 1920 rồi encode MP4. Có thanh tiến độ vì xuất video có thể mất thêm thời gian.

Ưu điểm của lựa chọn này là không bắt chiếc Mac Intel cũ vừa chơi vừa encode 1080p60 theo thời gian thực. Chậm encode chỉ khiến xuất lâu hơn, không tự làm mất frame trong video. Không được hứa tốc độ xuất nhanh hơn thời gian thực trên mọi máy.

## 3. Luồng dữ liệu

| Thành phần | Trách nhiệm | Không phụ thuộc vào |
| --- | --- | --- |
| Electron main | Vòng đời ứng dụng, IPC, lịch quay, đường dẫn, lưu file | Cửa sổ nào đang có focus |
| Simulation worker | Vật lý, bot, va chạm, điểm, timeline, snapshot hình ảnh | DOM và `requestAnimationFrame` |
| Recording writer | Ghi snapshot liên tục xuống các chunk trên đĩa | Video encoder hoặc cửa sổ hiển thị |
| Renderer | Canvas màn hình A và bảng điều khiển bên ngoài A | Quyền truy cập tùy ý vào Node |
| Export worker | Đọc một phiên quay đã chốt, dựng frame và đưa vào FFmpeg | Trạng thái game hiện tại hoặc cửa sổ hiển thị |
| FFmpeg child process | Encode H.264 và đóng gói MP4 | Screen Capture của hệ điều hành |

Simulation worker là nguồn sự thật duy nhất. Preview và bản quay đều lấy cùng trạng thái. Không tạo hai engine riêng với hai chuỗi ngẫu nhiên khác nhau để rồi video có diễn biến khác với những gì đã xem.

## 4. Màn hình A và giao diện

### 4.1. Kích thước

- Không gian logic của game: **360 × 640**.
- Tỉ lệ màn hình A luôn là **9:16**. Resize cửa sổ không làm đổi vật lý, tốc độ hoặc bố cục game.
- Preview mặc định khoảng 360 × 640 CSS pixel. Tự co vừa chiều cao cửa sổ khi cần, vẫn giữ đúng tỉ lệ.
- Canvas preview hỗ trợ backing resolution theo device pixel ratio, có giới hạn để tránh tốn GPU trên màn hình Retina.
- Canvas xuất: **1080 × 1920 pixel thật**, scale toàn bộ tọa độ logic lên 3 lần. Không chỉ upscale ảnh chụp preview chất lượng thấp.
- Có thể xuất 1080 × 1920 dù preview đang nhỏ hoặc cửa sổ đang thu nhỏ.

### 4.2. Bố cục

Desktop có màn hình A bên trái hoặc giữa; bảng điều khiển nằm bên cạnh. Cửa sổ nhỏ chuyển bảng điều khiển xuống dưới A. Tuyệt đối không đưa các nút điều khiển, lịch quay, đồng hồ quay hoặc thanh tiến độ xuất vào canvas game.

Trong A chỉ có cảnh chơi: nền, mây, chim, ống, mặt đất, điểm và hiệu ứng của game. Bảng điểm phải nằm trong vùng an toàn, tránh sát mép. Không có con trỏ chuột trong video.

Phong cách hình ảnh: sáng, hoạt hình, các lớp nền cuộn nhẹ, chim có hoạt ảnh cánh, nghiêng theo vận tốc và ống rõ nét. Tự tạo đồ họa Canvas/SVG hoặc dùng tài nguyên có giấy phép phù hợp; không cần sao chép sprite của game gốc hay tải ảnh từ game trong ảnh tham khảo.

### 4.3. Các nút và hành vi chính xác

| Nút | Hành vi |
| --- | --- |
| **Bắt đầu chơi game** | Từ trạng thái chưa chơi thì khởi tạo ván. Từ trạng thái dừng thì tiếp tục. Nếu đang chơi, không tạo vòng lặp thứ hai. |
| **Dừng chơi** | Dừng bot và mô phỏng chuyển động, giữ hình cuối. Nếu đang quay thì chốt phiên quay luôn. Nếu lịch đang quay thì kết thúc sớm và lưu thời lượng thực tế. Lịch tương lai vẫn giữ nguyên. |
| **Quay màn hình** | Tạo phiên quay mới; nếu game chưa chạy hoặc đang dừng thì tự bắt đầu/tiếp tục. Trong lúc quay, nút đổi thành **Dừng quay**. Dừng quay chỉ chốt bản ghi, game vẫn chơi. |
| **Xuất video** | Với phiên đang quay: chốt phiên đó rồi xuất; game vẫn chơi. Với phiên đã chốt: xuất phiên được chọn. Mở hộp thoại chọn nơi lưu MP4. Nếu người dùng hủy chọn đường dẫn thì giữ phiên quay để xuất sau. |
| **Đặt lịch quay màn hình** | Mở biểu mẫu ngày giờ bắt đầu, thời gian quay và xác nhận đặt lịch. Lịch tự bắt đầu game nếu cần, tự quay, tự chốt khi đủ thời lượng. |

Hiển thị trạng thái chơi, số điểm, trạng thái quay, thời gian đã quay, lịch sắp tới và tiến độ xuất ở bên ngoài A. Đơn vị thời lượng rõ ràng: phút/giây. Hiển thị lỗi bằng tiếng Việt có hướng dẫn xử lý.

Không bắt người dùng bấm phím để chim bay. Click vào A không được can thiệp điều khiển hoặc làm bot nhảy bất thường.

## 5. Game tự chơi lâu, không thua ngay

### 5.1. Mục tiêu trải nghiệm

Chế độ mặc định ưu tiên **sống lâu**. Bot chơi liên tục, không cố tình thua, không đặt giới hạn điểm. Thiết kế để một ván thường kéo dài nhiều phút và có thể dài hơn. Mục tiêu thử nghiệm: không thua trong ba phút đầu ở các seed kiểm thử chuẩn; ít nhất 95% trong 100 seed chạy được ba phút với cấu hình mặc định.

Đây là mục tiêu phải đo bằng chạy thử, không phải lời bảo đảm bot không bao giờ thua. Nếu thua, có hoạt ảnh ngắn và **tự bắt đầu ván mới sau khoảng 1,5 giây**, không cần người dùng thao tác. Bản quay tiếp tục xuyên qua cảnh thua và ván mới.

Không đạt mục tiêu bằng cách vô hiệu hóa va chạm, cho chim xuyên ống, dịch chuyển chim tức thời hoặc đặt một đường bay không tuân theo vật lý. Chim chỉ nhận hành động flap và chịu trọng lực.

### 5.2. Thông số khởi điểm để hiệu chỉnh

Các số sau dùng trong hệ tọa độ logic 360 × 640, chỉ là cấu hình ban đầu. Codex phải hiệu chỉnh theo kết quả thử nghiệm.

| Thông số | Giá trị ban đầu |
| --- | --- |
| Physics step | 1/120 giây |
| Frame timeline / video | 60 frame/giây |
| Chim ở tọa độ X | 100 |
| Bán kính va chạm chim | 11 |
| Trọng lực | 700 đơn vị/giây² |
| Vận tốc Y sau flap | -245 đơn vị/giây |
| Vận tốc rơi tối đa | 400 đơn vị/giây |
| Khoảng cách tối thiểu giữa hai flap | 0,14 giây |
| Tốc độ ống | 90 đơn vị/giây |
| Bề rộng ống | 58 |
| Khoảng cách giữa các cặp ống | 210 |
| Chiều cao khe hở | 185 |
| Mặt đất bắt đầu ở Y | 584 |
| Biên an toàn với mép khe | Tối thiểu 18, cộng bán kính chim |

Tính va chạm với thân và nắp ống đúng như hình vẽ, cộng giới hạn trần và mặt đất. Chấm điểm đúng một lần khi chim vượt qua một cặp ống.

### 5.3. Thuật toán bot

Không dùng AI API hoặc mô hình học máy. Dùng bộ điều khiển dự báo ngắn hạn có thể kiểm thử offline:

1. Tìm cặp ống sắp va chạm theo mép phải của ống và vị trí chim, có xét bán kính. Xem cả ống kế tiếp.
2. Tính thời gian chim tiếp cận và đi hết bề rộng cặp ống. Không chỉ xét một thời điểm ở giữa ống.
3. Vùng đi qua an toàn là khoảng từ mép trên khe cộng bán kính và biên an toàn đến mép dưới khe trừ các biên tương ứng.
4. Tạo một tập nhỏ lịch flap ứng viên trong khoảng dự báo 1,5–2,5 giây. Mô phỏng chúng bằng chính hàm vật lý của engine, cùng cooldown, trần vận tốc và collision.
5. Phạt rất nặng ứng viên va chạm; phạt lệch khỏi vùng an toàn, tốc độ Y quá lớn khi vào khe và flap dồn dập. Ưu tiên ứng viên vượt cả bề rộng ống và còn đường chuyển sang ống sau.
6. Chỉ thực hiện hành động của bước đầu, rồi tính lại sau 4–6 physics tick hoặc khi hoàn cảnh đổi. Giới hạn số ứng viên, không chạy tìm kiếm vô hạn trên thread giao diện.
7. Có hành vi cứu nguy theo dự báo va chạm, luôn bằng flap hợp lệ. Giữ quỹ đạo có nhịp lên xuống tự nhiên.

Chuyển mục tiêu giữa hai ống phải liên tục, không đổi sang khe kế tiếp quá sớm khi chim vẫn đang nằm trong vùng va chạm của ống trước.

### 5.4. Sinh ống hợp lý

- Dùng PRNG có seed; không gọi `Math.random()` rải rác trong vật lý và đồ họa.
- Tâm khe trong khoảng hợp lệ với trần và mặt đất. Chênh lệch giữa hai tâm khe liên tiếp ban đầu giới hạn khoảng 60 đơn vị.
- Kiểm tra tính khả thi bằng cùng vật lý và giới hạn flap. Không tạo khe không thể tới được trong thời gian giữa hai cặp ống.
- 30 giây đầu có bố cục dễ. Độ khó tăng nhẹ sau đó, có trần; không tăng mãi đến khi bất khả thi.
- Không thêm nhiễu quyết định gây chết sớm chỉ để tạo vẻ tự nhiên. Biến thiên nền, tâm khe và hoạt ảnh đã đủ tránh đơn điệu.
- Có tùy chọn **Chơi lâu** mặc định và **Thử thách** phụ. Kiểm thử yêu cầu sống lâu trên chế độ mặc định.

## 6. Đồng hồ và vận hành nền

Simulation worker sử dụng đồng hồ đơn điệu, ví dụ `performance.now()` của Node, với fixed timestep và accumulator. Không dùng số lần callback timer để suy ra thời gian đã trôi qua. Preview dùng `requestAnimationFrame` để vẽ, nhưng không làm chủ mô phỏng hoặc phiên quay.

Đặt `backgroundThrottling: false` cho cửa sổ như một biện pháp hỗ trợ. Dù preview có ngừng render khi thu nhỏ, simulation worker và ghi snapshot vẫn phải chạy.

Khi đang chơi, đang quay, xuất video hoặc có lịch chờ, dùng `powerSaveBlocker.start('prevent-app-suspension')`. Quản lý ID và giải phóng khi không còn nhu cầu. Có thể cho màn hình tắt; không dựa vào việc màn hình luôn sáng.

Khi worker bị chậm nhẹ, xử lý physics tick bị thiếu và phát snapshot đầy đủ theo thứ tự, không bỏ các tick được dùng cho bản ghi. Không catch-up vô hạn trên main thread. Có metric độ trễ worker, tách writer và export khỏi mô phỏng để tránh nghẽn. Độ trễ nghiêm trọng vượt ngưỡng, ví dụ hai giây, phải ghi nhận và báo; không âm thầm nén thời gian hoặc bỏ mất chuyển động để giả video mượt.

Chuyển ứng dụng, che cửa sổ và thu nhỏ cửa sổ là các trường hợp phải hỗ trợ. Tắt ứng dụng, máy ngủ thực sự, gập nắp Mac hoặc tắt nguồn không nằm trong bảo đảm chạy nền. Dùng sự kiện suspend/resume của Electron để chốt hoặc đánh dấu phiên bị gián đoạn; không tạo một đoạn video trống dài bằng thời gian máy ngủ. Hiển thị ghi chú ngắn này gần phần đặt lịch.

## 7. Ghi phiên quay độc lập với cửa sổ

### 7.1. Timeline và dữ liệu

Physics chạy 120 Hz, timeline bản quay chạy 60 Hz. Sau mỗi hai bước vật lý, có một trạng thái hình ảnh hoàn chỉnh. Ghi snapshot cho mọi frame 60 Hz trong phiên quay, không chỉ cho các frame preview thực sự được hiển thị.

Khi bắt đầu quay giữa ván, snapshot đầu tiên phải chứa toàn bộ cảnh tại thời điểm bắt đầu. Chốt lệnh bắt đầu/dừng ở biên frame, báo thời gian thực đã chốt; sai số thời lượng cho phép tối đa một frame.

Header mỗi phiên cần chứa ít nhất:

- `schemaVersion`, `engineVersion`, `renderVersion`, `assetVersion` hoặc hash bộ tài nguyên.
- ID phiên, ngày giờ bắt đầu, timezone, seed và cấu hình game.
- Độ phân giải xuất 1080 × 1920, fps 60, tọa độ logic 360 × 640.
- Trạng thái phiên, số frame đã ghi, thời lượng thực, nguồn bắt đầu thủ công hay lịch.

Snapshot cần đủ dựng lại **toàn bộ A**: vị trí và góc chim, trạng thái hoạt ảnh cánh, các ống và khe hở, vị trí cuộn mặt đất và từng lớp nền, điểm, điểm cao nhất đang hiển thị, trạng thái ván, đồng hồ hiệu ứng và các hiệu ứng đang tồn tại. Mọi hoạt ảnh dùng thời gian của snapshot, không dùng thời gian thực của export worker. Đóng băng cấu hình và tài nguyên liên quan cho phiên đó.

Không chỉ lưu seed rồi chạy lại phiên game từ đầu khi quay đã bắt đầu giữa ván. Không để render trong lúc export tự sinh ngẫu nhiên mới hoặc lấy điểm cao nhất mới từ cài đặt hiện tại.

### 7.2. Lưu theo chunk

- Ghi streaming xuống thư mục dữ liệu của ứng dụng, không giữ toàn bộ phiên trong RAM.
- Chunk khoảng 5–10 giây, nén bằng một định dạng hỗ trợ đọc tuần tự. Có thể dùng NDJSON gzip hoặc binary có schema rõ ràng.
- Giới hạn hàng đợi và buffer, có backpressure. Không gom hàng triệu snapshot hoặc frame pixel trong RAM.
- Ghi metadata nguyên tử; chỉ đánh dấu chunk hoàn tất sau khi ghi thành công. Giữ chunk cuối để phục hồi tối đa dữ liệu có thể đọc.
- Khi khởi động lại sau lỗi, phát hiện phiên chưa chốt và cho khôi phục phần hoàn chỉnh; không tự xóa dữ liệu của người dùng.
- Mỗi phiên quay có ID riêng, nhiều ván có thể nằm trong cùng phiên.
- Người dùng chọn lại các phiên đã quay để xuất; có thể xuất lại cùng phiên mà không phải chơi lại.
- Khi hết dung lượng hoặc writer lỗi, chốt phần còn cứu được, báo lỗi rõ. Game có thể tiếp tục nếu không ảnh hưởng an toàn dữ liệu.

## 8. Xuất MP4 1080p60 mượt

### 8.1. Render và encode

Export worker đọc một phiên **đã chốt**. Dùng Canvas native, chẳng hạn `@napi-rs/canvas`, để vẽ 1080 × 1920 bằng một hàm render chung với preview. Tạo adapter cho web/native nếu chữ ký context khác nhau. Xác minh bản native có binary chạy được trên macOS Intel của người dùng trước khi chốt phụ thuộc.

Render đủ mọi frame theo thứ tự. Với `N` snapshot, video có `N` frame và thời lượng `N / 60` giây. Đặt timestamp theo frame index. Tốc độ xử lý của CPU không được quyết định fps hoặc làm video chạy nhanh/chậm.

Stream raw pixel thẳng sang FFmpeg, xử lý backpressure khi `stdin.write()` trả false. Không ghi hàng chục nghìn PNG tạm và không lưu toàn bộ video raw trong RAM. Xác minh buffer native thực sự đúng RGBA hoặc chuyển đổi theo pixel format tương ứng; không đoán thứ tự kênh màu, stride hay alpha premultiplication.

Thông số xuất mặc định:

| Thuộc tính | Yêu cầu |
| --- | --- |
| Container | MP4 |
| Video codec | H.264 |
| Kích thước | 1080 × 1920 |
| Frame rate | Constant 60 fps |
| Pixel format thành phẩm | yuv420p |
| Sample aspect ratio | 1:1 |
| Bố cục | Chỉ màn hình A, không viền đen và không bảng điều khiển |
| Chất lượng x264 khởi điểm | CRF 18–20, preset veryfast |
| Tối ưu phát video | `-movflags +faststart` |
| Âm thanh bản đầu | Video không tiếng; không thu microphone hoặc âm thanh cửa sổ khác |

Ví dụ các tham số cho pipeline đã xác minh buffer RGBA:

```text
-f rawvideo -pixel_format rgba -video_size 1080x1920 -framerate 60 -i pipe:0
-an -c:v libx264 -preset veryfast -crf 19
-pix_fmt yuv420p -vf setsar=1 -movflags +faststart OUTPUT.mp4
```

Đây là danh sách tham số minh họa, không phải lệnh shell ghép chuỗi. Gọi `spawn()` với đường dẫn executable và mảng argument. Không dùng `shell: true`. Xử lý đường dẫn có khoảng trắng và ký tự tiếng Việt. Nếu bản FFmpeg không có libx264, phát hiện khi chạy chẩn đoán; có thể dùng H.264 VideoToolbox trên macOS sau khi đã thử thực tế, nhưng không áp các tham số CRF/preset của x264 cho encoder khác.

Ghi ra file tạm trong cùng thư mục đích. Chờ FFmpeg kết thúc thành công, dùng ffprobe kiểm tra kích thước/fps/số frame, rồi rename sang tên cuối. Không hiển thị thành công nếu FFmpeg bị lỗi hoặc file không đầy đủ. Không ghi đè file đang tồn tại mà không đi qua hành vi xác nhận của hộp thoại lưu.

### 8.2. Không gây giật game khi xuất

- Export chạy trong worker/process riêng, xử lý chunk tuần tự, có hủy và tiến độ.
- Chỉ một export chạy đồng thời ở bản đầu. Có thể quay phiên mới trong lúc xuất phiên cũ.
- Giới hạn thread FFmpeg ban đầu khoảng 2 trên Mac Intel, hiệu chỉnh bằng benchmark. Nhường CPU hoặc giảm tốc độ dựng export khi game đang chạy.
- Preview được ưu tiên. Khi cần, giảm chất lượng lớp nền hoặc backing resolution của preview, không âm thầm giảm video xuống 720p hoặc 30 fps.
- Có tùy chọn xuất 30 fps phụ, chỉ khi người dùng chủ động chọn. Mặc định vẫn 1080 × 1920 60 fps; bản 30 fps cần lấy mẫu timeline đều và giữ đúng thời lượng.
- Xuất có thể chậm hơn thời lượng phiên quay. UI phải báo tiến độ thực theo frame đã encode/đã xác nhận, không chạy thanh tiến độ giả.
- Giữ dữ liệu bản ghi nếu export bị hủy hoặc lỗi để thử lại.

Một file khai báo 60 fps nhưng nhân đôi từng frame 30 fps không được coi là đạt yêu cầu chuyển động 60 fps. Các frame phải dựng từ các trạng thái game tương ứng cách nhau 1/60 giây.

## 9. Đặt lịch quay màn hình

Đây là lịch **trong ứng dụng local**, không phải lịch của dịch vụ bên ngoài. Bản đầu hỗ trợ lịch một lần. Biểu mẫu gồm:

- Ngày bắt đầu, mặc định hôm nay.
- Giờ bắt đầu theo giờ địa phương trên máy, hiện rõ timezone; tại Việt Nam thường là Asia/Ho_Chi_Minh.
- Thời gian quay, nhập phút và giây; mặc định 10 phút, bắt buộc lớn hơn 0. Cho phép thời lượng dài và cảnh báo dung lượng ước tính khi cần.
- Nút lưu lịch và hủy lịch. Hiển thị thời điểm bắt đầu/kết thúc dự kiến trước khi lưu.

Lưu `startAt` UTC cùng timezone và dữ liệu nhập gốc. Khi lịch đã lưu, thay timezone hiển thị không được âm thầm đổi thời điểm UTC của lịch. Kiểm tra input, thời gian ở quá khứ và giá trị không hợp lệ.

Main process quản lý lịch, lưu xuống đĩa nguyên tử và kiểm tra deadline. Khi đến giờ:

1. Nếu game đang dừng hoặc chưa chơi, tự bắt đầu/tiếp tục.
2. Tạo phiên quay ngay tại frame boundary và liên kết với lịch.
3. Dùng đồng hồ đơn điệu để đo thời lượng kể từ lúc bắt đầu thực tế, không lấy số callback timer hay thay đổi giờ hệ thống làm căn cứ.
4. Đủ thời lượng thì chốt bản ghi; game tiếp tục chơi.
5. Báo **Đã quay xong** và cho xuất video từ phiên này. Không tự mở hộp thoại khi người dùng đang làm việc ở cửa sổ khác.

Lịch có trạng thái `pending`, `running`, `completed`, `cancelled`, `missed`, `interrupted`, `failed`. Bản đầu cho tối đa một lịch pending/running; lịch đã hoàn thành được giữ trong lịch sử.

Quy tắc xung đột: không cho hai phiên quay hoạt động cùng lúc. Nếu lịch đến giờ khi đang quay thủ công, đánh dấu lịch bị bỏ lỡ do đang có phiên khác, không đóng hoặc ghi đè phiên thủ công. Hiện thông báo rõ. Nếu người dùng bắt đầu quay thủ công trước lịch, hiện nhắc lịch sắp tới trong bảng điều khiển.

Khi đóng rồi mở lại ứng dụng, khôi phục lịch còn ở tương lai. Lịch đã quá giờ khi ứng dụng không chạy được đánh dấu `missed`, không giả vờ đã quay trong thời gian ứng dụng đóng. Không yêu cầu tự khởi động máy hoặc tự đánh thức máy ở bản đầu.

Giữ ứng dụng chạy khi thu nhỏ. Trên macOS, có thể giữ main process khi đóng cửa sổ theo quy ước ứng dụng và mở lại bằng Dock, nhưng phải ghi rõ hành vi trong hướng dẫn sử dụng. Khi người dùng chọn Quit, chốt phiên và lưu trạng thái trước khi thoát; lịch không hoạt động sau Quit.

## 10. Máy trạng thái và xử lý lệnh

Tách trạng thái chơi, quay và xuất; không dùng một biến `isRunning` cho tất cả.

| Hệ | Trạng thái tối thiểu |
| --- | --- |
| Game | idle, running, paused, gameOver, restarting |
| Quay | idle, recording, sealing, ready, interrupted, error |
| Export | idle, preparing, rendering, encoding, verifying, completed, cancelled, error |

Các lệnh đi qua main process và có ID/idempotency khi cần. Disable nút lúc thao tác không hợp lệ. Click liên tục không sinh nhiều worker, nhiều phiên quay hoặc nhiều export cùng lúc.

- Dừng quay không dừng chơi.
- Dừng chơi chốt bản quay hiện tại.
- Xuất phiên cũ không làm đổi bản quay mới đang chạy.
- Cảnh gameOver/restarting không làm gián đoạn phiên quay.
- Hủy hộp thoại lưu không xóa bản ghi.
- Lịch hoàn thành không tự tắt game.

## 11. Hiệu năng và độ mượt

Mục tiêu preview: 60 fps trên máy mục tiêu với hình ảnh đơn giản. Không gọi React `setState` 60 lần mỗi giây để vẽ game; dùng Canvas và snapshot buffer. Trạng thái số liệu bên ngoài A có thể cập nhật 4–10 lần/giây.

Tách simulation, IO và export. Cache nền/tài nguyên, hạn chế cấp phát object trong hot path, bỏ ống ngoài màn hình, không dùng filter blur/shadow nặng mỗi frame. Không phụ thuộc fetch tài nguyên lúc đang chơi. Không render 1080 × 1920 để rồi truyền buffer RGBA lớn 60 lần/giây qua IPC cho preview.

Preview đọc snapshot nhẹ và nội suy khi cần. Export đọc snapshot đã ghi ở tần suất 60 Hz và render đúng từng frame. Không nội suy qua ranh giới ván chết/reset vì sẽ làm chim hoặc ống trượt qua cảnh mới.

Thu thập: preview FPS, p95 frame time, simulation lag, số frame bản ghi, độ sâu queue, tốc độ export và peak memory. Những số liệu chẩn đoán nằm ngoài A và có thể ẩn. Phải phân biệt đo trên máy phát triển với đo trực tiếp trên Mac của người dùng; không ghi kết quả máy chưa thử là đã đạt.

## 12. Đóng gói, tương thích và an toàn IPC

- Chọn bản Electron đang được hỗ trợ và còn hỗ trợ macOS 13 Intel tại thời điểm triển khai. Kiểm tra yêu cầu Node cho tooling; hướng dẫn nâng nếu Node 20 trên máy không còn phù hợp. Không tự ghim một major cũ chỉ vì tài liệu nêu Node 20.
- Ghim phiên bản phụ thuộc đã kiểm thử bằng lockfile. Không hardcode mọi gói ở `latest`.
- Bundle hoặc cung cấp cơ chế cài FFmpeg/ffprobe native đúng kiến trúc. Có chẩn đoán đường dẫn, encoder và khả năng chạy, không giả định người dùng đã có Homebrew hoặc FFmpeg.
- Binary native phải được giải nén đúng khỏi ASAR, có quyền thực thi trên macOS và được tìm bằng đường dẫn phù hợp khi đóng gói. Kiểm thử cả development và bản `.app`.
- Kiểm tra thư viện Canvas native thực tế trên darwin x64; không dùng binary arm64 trên Mac Intel.
- `contextIsolation: true`, `nodeIntegration: false`; preload chỉ mở những IPC API cần thiết. Validate payload ở main. Không trao API thực thi shell tùy ý cho renderer.
- Cấu hình, phiên quay và lịch sử ở thư mục dữ liệu ứng dụng, không ghi vào thư mục mã nguồn hay thư mục cài đặt chỉ đọc.
- Không tự tải mã hoặc tài nguyên từ mạng mỗi lần chạy. Tài nguyên và font render phải có sẵn, đồng nhất giữa preview và export.

## 13. Cấu trúc mã nguồn gợi ý

Đây là cấu trúc đề xuất; có thể điều chỉnh nếu giữ được ranh giới trách nhiệm.

```text
flappy-auto-recorder/
  README.md
  package.json
  package-lock.json
  electron-builder.yml
  electron/
    main.ts
    preload.ts
    ipc.ts
    services/
      scheduler.ts
      power.ts
      recording-store.ts
      ffmpeg-service.ts
      settings-store.ts
    workers/
      simulation.worker.ts
      recording-writer.worker.ts
      export.worker.ts
  src/
    App.tsx
    components/
      GameViewport.tsx
      ControlPanel.tsx
      ScheduleDialog.tsx
      RecordingList.tsx
      ExportProgress.tsx
    preview/
      snapshot-buffer.ts
      canvas-preview.ts
    styles/
      app.css
  shared/
    engine/
      state.ts
      physics.ts
      collisions.ts
      obstacles.ts
      autoplayer.ts
      rng.ts
      timeline.ts
    rendering/
      draw-scene.ts
      canvas-adapter.ts
      assets.ts
    contracts/
      ipc.ts
      recording.ts
      schedule.ts
  assets/
    sprites/
    fonts/
  scripts/
    doctor.ts
    benchmark-bot.ts
    verify-video.ts
  tests/
    physics.test.ts
    autoplayer.test.ts
    recording.test.ts
    scheduler.test.ts
  docs/
    RUN_MACOS.md
    RUN_WINDOWS.md
    ARCHITECTURE.md
    TEST_RESULTS.md
```

## 14. Các bước triển khai cho Codex

1. Đọc toàn bộ đặc tả, xem repo nếu có, chốt công nghệ và kiểm tra native dependency trên hệ mục tiêu. Tạo project, scripts dev/build/doctor và IPC cơ bản.
2. Làm engine thuần TypeScript có fixed step, va chạm và điểm. Chạy headless để hiệu chỉnh bot trước khi làm quay video. Tự chơi và tự restart phải chạy được.
3. Làm UI với màn hình A đúng tỉ lệ, đồ họa và đủ các nút. Giữ engine trong worker, chứng minh chuyển cửa sổ không làm dừng ván.
4. Làm snapshot timeline và writer streaming, chốt bản ghi, danh sách phiên và phục hồi dữ liệu.
5. Làm export worker + Canvas native + FFmpeg; xuất một video ngắn, kiểm tra pixel format, độ phân giải, frame count và thời lượng trước khi thử phiên dài.
6. Làm lịch theo deadline main process, persistence, tự bắt đầu/chốt và xử lý xung đột. Kiểm thử lịch khi cửa sổ ẩn.
7. Kiểm thử quay/xuất dài, bộ nhớ, chuyển ứng dụng và đóng gói Mac Intel. Hiệu chỉnh chất lượng để preview mượt nhưng video vẫn đủ 1080p60.
8. Bàn giao toàn bộ mã nguồn, lockfile, hướng dẫn tiếng Việt, kết quả đo thật và các giới hạn còn lại. Không để TODO cho các chức năng bắt buộc.

Có thể dùng các skill/tool sẵn có nếu giúp triển khai: kỹ năng tạo hình cho sprite tự thiết kế, công cụ kiểm thử UI, công cụ đọc tài liệu chính thức hoặc benchmark. Không bắt người dùng mua skill/dịch vụ. Nếu không có skill cụ thể, tiếp tục bằng thư viện và công cụ local. Không xây website public hoặc triển khai hosting vì yêu cầu là ứng dụng local.

## 15. Tiêu chí nghiệm thu bắt buộc

| Mã | Kiểm thử | Điều kiện đạt |
| --- | --- | --- |
| A01 | Resize và đo viewport | A luôn 9:16, vật lý không thay đổi theo kích thước cửa sổ |
| A02 | Bắt đầu, dừng, tiếp tục, click nhanh | Không chạy chồng vòng lặp; dừng/tiếp tục đúng hành vi đã nêu |
| A03 | Bot headless 100 seed, mỗi seed 180 giây | Ít nhất 95 seed sống hết 180 giây; công bố seed/config/kết quả |
| A04 | Cố ý đưa trạng thái gần chết trong test | Va chạm có thật; tự restart sau khoảng 1,5 giây; phiên quay không bị chốt |
| A05 | Quay thủ công 120 giây | Chỉ A; số frame và duration đúng, sai số tối đa 1/60 giây |
| A06 | Trong phiên 5 phút, chuyển ứng dụng và che cửa sổ ít nhất 3 phút | Game timeline và bản ghi liên tục; không lẫn cửa sổ khác, không mất đoạn |
| A07 | Quay khi thu nhỏ cửa sổ ít nhất 2 phút | Snapshot vẫn tiến triển; video không đứng hình do preview ngừng vẽ |
| A08 | Đặt lịch sau 1 phút, quay 2 phút rồi chuyển ứng dụng | Tự bắt đầu, chốt đúng thời lượng; lịch không cần renderer đang hoạt động |
| A09 | Restart ứng dụng trước thời điểm lịch tương lai | Lịch được khôi phục đúng; lịch đã quá giờ khi app đóng được báo missed |
| A10 | Xuất bằng ffprobe | H.264, 1080 × 1920, yuv420p, SAR 1:1, CFR 60 fps, frame count đúng |
| A11 | So các frame đầu/giữa/cuối với snapshot | Đúng cảnh, đúng điểm, đúng ván; không có điều khiển ngoài A |
| A12 | Quay 30 phút, xuất và quan sát bộ nhớ | Không giữ cả phiên trong RAM; memory sau ổn định không tăng theo toàn bộ thời lượng |
| A13 | Xuất phiên cũ trong lúc chơi/quay phiên mới | UI dùng được, simulation không bị ảnh hưởng đáng kể, phiên mới không bị sửa |
| A14 | Hủy export, hết dung lượng, FFmpeg lỗi, hủy chọn đường dẫn | Lỗi rõ; dữ liệu quay còn để thử lại; không báo file lỗi là thành công |
| A15 | Đường dẫn chứa dấu tiếng Việt và khoảng trắng | Lưu và mở video được, không lỗi shell quoting |
| A16 | Bản đóng gói trên Mac Intel macOS 13 | Native Canvas/FFmpeg chạy được; đường dẫn ASAR đúng; không cần mã nguồn để mở app |
| A17 | Ngắt mạng sau khi cài xong | Chơi, quay, lịch và xuất vẫn hoạt động |

Đo preview khi cửa sổ đang hiển thị: mục tiêu khoảng 60 fps, p95 frame time gần hoặc dưới 20 ms trong cảnh bình thường; công bố phần cứng và điều kiện đo. Kiểm tra mượt video bằng xem frame chuyển động liên tiếp, không chỉ bằng metadata fps. So sánh timeline khi foreground/background để phát hiện trò chơi bị chạy chậm khi ẩn.

Kiểm thử unit tập trung vào vật lý, va chạm, tính điểm, bot, timeline và lịch. Kiểm thử tích hợp cần kiểm tra file MP4 và vận hành nền thật. Nếu môi trường Codex không phải máy Mac mục tiêu, ghi rõ các thử nghiệm chưa chạy và bàn giao checklist để xác minh trên Mac; không bỏ chức năng hoặc ghi đã đạt khi chưa có bằng chứng.

## 16. Tài liệu sử dụng phải bàn giao cùng app

README của project phải có các lệnh thực sự tồn tại: cài phụ thuộc, mở dev, build, đóng gói và kiểm tra chẩn đoán. `RUN_MACOS.md` giải thích bằng tiếng Việt cách mở trên Mac Intel, vị trí lưu video, đặt lịch, thu nhỏ/chuyển ứng dụng và xử lý FFmpeg/native dependency lỗi.

Người dùng cần hiểu bốn điểm:

1. Chỉ xem máy chơi; không cần bấm cho chim bay.
2. Quay chỉ ghi nội dung A. Có thể chuyển cửa sổ hoặc thu nhỏ ứng dụng.
3. Nhấn Xuất video để dựng MP4; chờ thanh tiến độ. Lịch quay hoàn tất vẫn giữ bản ghi để xuất sau.
4. Ứng dụng phải đang chạy, máy không ngủ/gập nắp/tắt nguồn khi lịch hoặc phiên quay hoạt động.

`TEST_RESULTS.md` ghi kết quả bot, file video, benchmark CPU/memory, thử chạy nền và đóng gói; mỗi mục phải có Passed/Failed/Not tested cùng môi trường.

## 17. Prompt tổng để gửi cho Codex

Sao chép đoạn dưới vào Codex và đính kèm file này hoặc đặt nó trong thư mục project.

```text
Hãy đọc toàn bộ README_Flappy_Bird_Tu_Choi_Quay_1080p.md và triển khai ứng dụng hoàn chỉnh theo đặc tả. Tôi chỉ xem máy tự chơi Flappy Bird. Game nằm trong màn hình A 9:16. Các nút bắt đầu/dừng chơi, quay/dừng quay, xuất video và đặt lịch nằm ngoài A. Video MP4 dọc 1080×1920 ở 60 fps chỉ chứa A, và phải tiếp tục ghi khi tôi chuyển sang ứng dụng khác hoặc thu nhỏ cửa sổ.

Ưu tiên chạy local trên MacBook Pro 2017 Intel macOS 13.7.6. Dùng Electron, simulation worker độc lập với renderer, ghi snapshot timeline xuống đĩa và dựng video bằng worker + FFmpeg native khi xuất. Không phụ thuộc screen capture, cửa sổ foreground hay requestAnimationFrame của tab ẩn để ghi hình. Bot phải sống lâu, tuân theo vật lý và tự chơi lại khi thua. Đặt lịch hoạt động trong main process, khôi phục lịch tương lai sau restart và xử lý xung đột rõ ràng.

Bạn có thể dùng tool/skill phù hợp. Tự xử lý những lựa chọn triển khai thông thường. Hãy code, chạy các kiểm thử quan trọng, kiểm tra video bằng ffprobe và tạo hướng dẫn chạy bằng tiếng Việt. Tiếp tục đến khi có sản phẩm chạy được, không chỉ dừng ở dàn ý hoặc mẫu UI. Báo trung thực các thử nghiệm chưa chạy trên máy Mac thực tế.
```

## 18. Tài liệu kỹ thuật chính thức để đối chiếu khi triển khai

Kiểm tra lại phiên bản API và yêu cầu hệ điều hành khi viết code. Các nguồn sau hỗ trợ từng phần của thiết kế; kiến trúc snapshot và các thông số bot là quyết định triển khai của đặc tả này, không phải bảo đảm của các thư viện.

- Electron WebPreferences: https://www.electronjs.org/docs/latest/api/structures/web-preferences
- Electron powerSaveBlocker: https://www.electronjs.org/docs/latest/api/power-save-blocker
- Electron powerMonitor: https://www.electronjs.org/docs/latest/api/power-monitor
- Node.js worker_threads: https://nodejs.org/api/worker_threads.html
- Canvas native: https://github.com/Brooooooklyn/canvas
- FFmpeg CLI: https://ffmpeg.org/ffmpeg.html
- FFmpeg codecs: https://ffmpeg.org/ffmpeg-codecs.html
- FFmpeg formats: https://ffmpeg.org/ffmpeg-formats.html
- ffprobe: https://ffmpeg.org/ffprobe.html

