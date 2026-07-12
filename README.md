const docs = [
  new Document({
    pageContent: `
Tiêu đề: Hướng dẫn đặt sân bóng

Để đặt sân bóng trên website, khách hàng thực hiện theo các bước sau:

Bước 1:
Đăng nhập vào tài khoản.

Bước 2:
Truy cập danh sách sân bóng và lựa chọn sân muốn thuê.

Bước 3:
Xem thông tin chi tiết của sân như địa chỉ, mô tả, tiện ích, loại sân và bảng giá theo từng khung giờ.

Bước 4:
Chọn ngày thi đấu.

Bước 5:
Chọn khung giờ còn trống. Các khung giờ đã được người khác đặt sẽ không thể lựa chọn.

Bước 6:
Kiểm tra lại thông tin đặt sân và nhấn nút "Đặt sân".

Bước 7:
Lựa chọn hình thức thanh toán:
- Thanh toán trực tuyến qua VNPay.
- Thanh toán trực tiếp tại sân.

Bước 8:
Sau khi đặt sân thành công, đơn đặt sân sẽ được lưu trong lịch sử đặt sân của người dùng.

Lưu ý:
- Người dùng phải đăng nhập mới có thể đặt sân.
- Chỉ có thể đặt các khung giờ còn trống.
- Nên đến sân trước giờ thi đấu từ 10 đến 15 phút.
`,
    metadata: {
      sourceType: "guide",
      sourceId: 1,
    },
  }),

  new Document({
    pageContent: `
Tiêu đề: Hướng dẫn thanh toán

Website hỗ trợ hai hình thức thanh toán.

1. Thanh toán trực tuyến qua VNPay
- Sau khi chọn sân và khung giờ, khách hàng có thể thanh toán ngay trên website.
- Sau khi giao dịch thành công, hệ thống sẽ tự động xác nhận đơn đặt sân.
- Khách hàng không cần thanh toán lại khi đến sân.

2. Thanh toán trực tiếp tại sân
- Khách hàng có thể đặt sân trước trên website và lựa chọn thanh toán tại sân.
- Khi đến sân, khách hàng thanh toán trực tiếp cho chủ sân hoặc nhân viên quản lý bằng tiền mặt hoặc phương thức thanh toán mà sân hỗ trợ.
- Sau khi thanh toán, khách hàng sẽ được sử dụng sân theo đúng thời gian đã đặt.

Lưu ý:
- Nếu thanh toán trực tuyến không thành công, khách hàng có thể thử lại hoặc chọn thanh toán tại sân.
- Vui lòng kiểm tra kỹ thông tin sân, ngày thi đấu và khung giờ trước khi xác nhận đặt sân.
`,
    metadata: {
      sourceType: "guide",
      sourceId: 2,
    },
  }),

  new Document({
    pageContent: `
Tiêu đề: Quy định sử dụng sân bóng

Để đảm bảo trải nghiệm tốt cho tất cả khách hàng, vui lòng tuân thủ các quy định sau:

- Có mặt trước giờ thi đấu từ 10 đến 15 phút.
- Sử dụng sân đúng khung giờ đã đặt.
- Giữ gìn vệ sinh chung và bảo quản cơ sở vật chất.
- Không mang các chất cấm, chất dễ cháy nổ hoặc vật nguy hiểm vào sân.
- Không gây mất trật tự hoặc ảnh hưởng đến các sân khác.
- Nếu làm hư hỏng tài sản của sân, khách hàng phải chịu trách nhiệm bồi thường theo quy định của chủ sân.
`,
    metadata: {
      sourceType: "policy",
      sourceId: 3,
    },
  }),

  new Document({
    pageContent: `
Tiêu đề: Chính sách hủy đặt sân

Khách hàng có thể hủy đơn đặt sân nếu đơn chưa được sử dụng.

Quy định:
- Đơn đã hoàn thành hoặc đã sử dụng sẽ không thể hủy.
- Nếu thanh toán trực tuyến, việc hoàn tiền (nếu có) sẽ theo chính sách của chủ sân hoặc quản trị viên.
- Nếu chọn thanh toán tại sân, khách hàng nên thông báo sớm khi không thể đến để chủ sân sắp xếp lịch cho khách khác.

Nếu cần hỗ trợ hủy hoặc thay đổi lịch đặt sân, vui lòng liên hệ quản trị viên.
`,
    metadata: {
      sourceType: "policy",
      sourceId: 4,
    },
  }),

  new Document({
    pageContent: `
Tiêu đề: Câu hỏi thường gặp

Câu hỏi: Có cần đăng nhập để đặt sân không?
Trả lời: Có. Người dùng cần đăng nhập trước khi đặt sân.

Câu hỏi: Tôi có thể thanh toán khi đến sân không?
Trả lời: Có. Website hỗ trợ thanh toán trực tuyến qua VNPay hoặc thanh toán trực tiếp tại sân.

Câu hỏi: Website hỗ trợ thanh toán bằng gì?
Trả lời: Website hỗ trợ thanh toán trực tuyến qua VNPay và thanh toán trực tiếp tại sân.

Câu hỏi: Làm sao biết khung giờ còn trống?
Trả lời: Hệ thống sẽ hiển thị các khung giờ đã được đặt và chỉ cho phép chọn những khung giờ còn trống.

Câu hỏi: Tôi có thể xem lịch sử đặt sân ở đâu?
Trả lời: Người dùng có thể xem lịch sử đặt sân trong trang cá nhân sau khi đăng nhập.

Câu hỏi: Tôi có thể hủy đơn đặt sân không?
Trả lời: Có. Khách hàng có thể hủy đơn theo quy định của hệ thống và chủ sân.

Câu hỏi: Nếu thanh toán trực tuyến bị lỗi thì sao?
Trả lời: Khách hàng có thể thực hiện lại giao dịch hoặc chọn thanh toán trực tiếp tại sân.
`,
    metadata: {
      sourceType: "faq",
      sourceId: 5,
    },
  }),

  new Document({
    pageContent: `
Tiêu đề: Hỗ trợ khách hàng

Nếu gặp sự cố trong quá trình sử dụng website, khách hàng có thể liên hệ quản trị viên để được hỗ trợ.

Các trường hợp hỗ trợ bao gồm:
- Không thể đăng nhập.
- Không thể đặt sân.
- Thanh toán không thành công.
- Đã thanh toán nhưng chưa nhận được xác nhận.
- Muốn thay đổi hoặc hủy đơn đặt sân.
- Báo lỗi hệ thống hoặc góp ý về dịch vụ.

Quản trị viên sẽ tiếp nhận và hỗ trợ khách hàng trong thời gian sớm nhất.
`,
    metadata: {
      sourceType: "support",
      sourceId: 6,
    },
  }),
];