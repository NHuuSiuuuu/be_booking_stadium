const { pool } = require("../pool");
const AppError = require("../utils/AppError");

const {
  VNPay,
  ignoreLogger,
  ProductCode,
  VnpLocale,
  dateFormat,
} = require("vnpay");
const nodemailer = require("nodemailer");

// Gửi email OTp
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Tạo booking
module.exports.create = async (req) => {
  try {
    const {
      stadium_id,
      price_config_id,
      booking_date,
      fullName,
      email,
      phone,
      note,
      paymentMethod,
    } = req.body;
    const userId = req.user.id;
    // console.log("data", data);
    // Lấy giá
    const price = await pool.query(
      `
        SELECT price 
        FROM price_configs
        WHERE id = $1
        `,
      [price_config_id],
    );

    if (price.rows.length === 0) {
      throw new AppError("Khung giờ không tồn tại", 409);
    }
    const totalPrice = price.rows[0].price;

    // Kiểm tra trùng lịch - cùng sân, cùng ngày, cùng khung giờ
    const conflict = await pool.query(
      `
        SELECT id FROM bookings
        WHERE stadium_id = $1
        AND price_config_id = $2
        AND booking_date = $3
        AND status != 'cancelled'
        `,
      [stadium_id, price_config_id, booking_date],
    );

    if (conflict.rows.length > 0) {
      throw new AppError("Khung giờ này đã được đặt", 409);
    }

    // Tạo booking
    const result = await pool.query(
      `INSERT INTO bookings 
        (user_id, stadium_id, price_config_id, booking_date, full_name, email, phone, note, payment_method, total_price, payment_status, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'unpaid','pending')
        RETURNING *`,
      [
        userId, //
        stadium_id,
        price_config_id,
        booking_date,
        fullName,
        email,
        phone,
        note ?? null,
        paymentMethod ?? "cash",
        totalPrice,
      ],
    );
    const booking = result.rows[0];
    // Lấy sân + giờ
    const detail = await pool.query(
      `
      SELECT s.name AS stadium_name, pc.start_time, pc.end_time
      FROM bookings b
      JOIN stadiums s ON b.stadium_id = s.id
      JOIN price_configs pc ON b.price_config_id = pc.id
      WHERE b.id = $1
      `,
      [booking.id],
    );
    const info = detail.rows[0];
    const bookingLink = `https://fe-booking-stadium.vercel.app/booking/success/${booking.id}`;
    const finalPaymentMethod =
      booking.payment_method === "online"
        ? "Thanh toán online"
        : "Thanh toán tại sân";
    try {
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Đặt sân thành công",
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto; background: #000;">
          
          <div style="padding: 24px; border-bottom: 1px solid #222;">
            <span style="color: white; font-size: 18px; font-weight: bold;">
              SÂNBÓNGHN
            </span>
          </div>

          <div style="padding: 40px 24px;">
            <h2 style="color: white;">ĐẶT SÂN THÀNH CÔNG ⚽</h2>

            <p style="color: #aaa;">
              Cảm ơn bạn đã đặt sân. Thông tin chi tiết:
            </p>

            <div style="background: #fff; padding: 20px; margin: 20px 0;">
              <p><b>Mã đơn:</b> #${booking.id}</p>
              <p><b>Sân:</b> ${info.stadium_name}</p>
              <p><b>Ngày:</b> ${booking_date}</p>
              <p><b>Giờ:</b> ${info.start_time} - ${info.end_time}</p>
              <p><b>Tổng tiền:</b> ${totalPrice.toLocaleString("vi-VN")}đ</p>
              <p><b>Thanh toán:</b> ${finalPaymentMethod}</p>
            </div>

            <div style="text-align:center;">
              <a href="${bookingLink}" 
                style="background:white;color:black;padding:10px 20px;text-decoration:none;font-weight:bold;">
                Xem đơn
              </a>
            </div>
          </div>

          <div style="padding: 16px; border-top: 1px solid #222;">
            <span style="color: #444; font-size: 12px;">
              © 2026 SÂNBÓNGHN
            </span>
          </div>
        </div>
        `,
      });
    } catch (err) {
      console.log("Mail lỗi:", err.message);
    }

    if (result.rows[0].payment_method === "online") {
      const booking = await pool.query(
        `
        SELECT* 
        FROM bookings
        WHERE id = $1
        `,
        [result.rows[0].id],
      );
      // console.log("booking", booking.rows[0].total_price);
      // console.log("rows.length", booking.rows.length);
      // console.log("booking.rows[0].length", booking.rows[0].length);

      if (booking.rows.length === 0) {
        throw new AppError("Booking không tồn tại", 404);
      }
      const vnpay = new VNPay({
        // ⚡ Cấu hình bắt buộc
        tmnCode: "TQ3L35SC",
        secureSecret: "WFGSQJSZYSC75J3BW7J7YFCB05V4DOT6",
        vnpayHost: "https://sandbox.vnpayment.vn",

        // 🔧 Cấu hình tùy chọn
        testMode: true, // Chế độ test
        hashAlgorithm: "SHA512", // Thuật toán mã hóa
        // enableLog: true, // Bật/tắt log
        loggerFn: ignoreLogger, // Custom logger
      });
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const vnpayResponse = await vnpay.buildPaymentUrl({
        vnp_Amount: booking.rows[0].total_price,
        vnp_IpAddr: req.ip,
        vnp_TxnRef: booking.rows[0].id,
        vnp_OrderInfo: `Thanh toán đơn đặt # ${booking.rows[0].id}`,
        vnp_ReturnUrl:
          "https://fe-booking-stadium.vercel.app/api/check-payment-vnpay",
        vnp_Locale: VnpLocale.VN,
        vnp_CreateDate: dateFormat(new Date()),
        vnp_ExpireDate: dateFormat(tomorrow),
      });

      return {
        message: "Đặt sân thành công",
        payment_method: "online",
        vnpayResponse,
        bookingId: booking.rows[0].id,
      };
    }

    return {
      message: "Đặt sân thành công",
      payment_method: "cash",
      booking: result.rows[0],
    };
  } catch (e) {
    throw e;
  }
};

// Danh sách booking
module.exports.get = async ({ filter, sort, limit, page, keyword }) => {
  try {
    let whereSql = `
    FROM bookings 
    JOIN stadiums ON stadiums.id = bookings.stadium_id
    JOIN price_configs ON price_configs.id = bookings.price_config_id
    WHERE 1=1`;

    let orderSql = ``;
    let values = [];
    let index = 1;

    // Lọc theo status
    if (filter) {
      const [key, value] = filter.split(":");
      whereSql += ` AND bookings.status = $${index}`;
      values.push(value);
      index++;
    }

    // console.log("filter", filter)
    if (sort) {
      // console.log(sort);
      const [key, value] = sort.split(":");
      // console.log("key", key);
      console.log("value", value);
      // Các trường sort
      const allowedFields = {
        booking_date: "bookings.booking_date",
        total_price: "bookings.total_price",
        created_at: "bookings.created_at",
      };
      const direction = value === "desc" ? "DESC" : "ASC";

      if (allowedFields[key]) {
        orderSql += ` ORDER BY ${key} ${direction}`;
      }
    } else {
      orderSql += ` ORDER BY created_at DESC `;
    }
    console.log("orderSql", orderSql);
    if (keyword && keyword.trim() !== "") {
      whereSql += ` AND (
      unaccent(bookings.full_name) ILIKE unaccent($${index})
      OR unaccent(bookings.email) ILIKE unaccent($${index})
      OR unaccent(bookings.phone) ILIKE unaccent($${index})
      OR bookings.stadium_id::text ILIKE $${index}
      OR unaccent(stadiums.name) ILIKE unaccent($${index})
      OR TO_CHAR(bookings.booking_date AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') ILIKE $${index}
    )`;
      values.push(`%${keyword.trim()}%`);
      index++;
    }

    // Limit
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;

    let limitSql = ` LIMIT $${index}`;
    values.push(limitNumber);
    index++;

    // OFFSET - skip
    let offsetSql = ` OFFSET $${index}`;
    values.push((pageNumber - 1) * limitNumber);
    index++;

    const result = await pool.query(
      `
      SELECT
      bookings. *,

      stadiums.name AS stadium_name,

      price_configs.start_time,
      price_configs.end_time,
      price_configs.price
      ${whereSql} ${orderSql} ${limitSql} ${offsetSql}
      `,
      values,
    );

    // OVER tính toán ko làm mất dữ liệu từng dòng
    const totalStadium = await pool.query(
      `SELECT COUNT(*) AS total
   ${whereSql}
  `,
      values.slice(0, values.length - 2), // bỏ limit + offset
    );
    const total = totalStadium.rows[0].total;

    return {
      status: "OK",
      message: "success",

      result: result.rows,
      total: total,
      pageCurrent: pageNumber,
      totalPage: Math.ceil(total / limitNumber),
    };
  } catch (e) {
    throw e;
  }
};

// Booking thành công
module.exports.success = async (id) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM bookings
      WHERE id = $1
    
      `,
      [id],
    );
    if (!result.rows[0]) {
      throw new AppError("Booking không tồn tại", 409);
    }
    const stadiumId = result.rows[0].stadium_id;
    const priceConfigId = result.rows[0].price_config_id;
    const stadium = await pool.query(
      `
      SELECT name, type, address, thumbnail
      FROM stadiums
      WHERE id = $1
      `,
      [stadiumId],
    );

    const priceConfig = await pool.query(
      `
      SELECT day_of_week, start_time, end_time
      FROM price_configs
      WHERE id = $1
      `,
      [priceConfigId],
    );

    const stadiumBooking = {
      name: stadium.rows[0].name,
      type: stadium.rows[0].type,
      address: stadium.rows[0].address,
      thumbnail: stadium.rows[0].thumbnail[0],
      day_of_week: priceConfig.rows[0].day_of_week,
      start_time: priceConfig.rows[0].start_time,
      end_time: priceConfig.rows[0].end_time,
    };

    return {
      status: "OK",
      message: "success",
      data: {
        stadiumBooking,
        result: result.rows[0],
      },
    };
  } catch (e) {
    throw e;
  }
};

// Kiểm tra sân bóng đã được đặt
// API trả về: mảng slot đã được đặt + slot đang được giữ
module.exports.bookedSlots = async (stadium_id, date) => {
  try {
    // Kiểm tra trùng lịch - cùng sân, cùng ngày
    // Lấy ra mảng slot (price_config_id) đã được đặt

    const booked = await pool.query(
      `
        SELECT price_config_id 
        FROM bookings
        WHERE stadium_id = $1
        AND booking_date = $2
        AND status != 'cancelled'
        `,
      [stadium_id, date],
    );
    const holding = await pool.query(
      `
        SELECT price_config_id
        FROM booking_holds
        WHERE stadium_id = $1
        AND booking_date = $2
        AND expires_at > NOW()
      `,
      [stadium_id, date],
    );

    console.log(
      "Slot đã đặt",
      booked.rows.map((r) => r.price_config_id),
    );

    console.log(
      "Slot đang được giữ",
      holding.rows.map((r) => r.price_config_id),
    );
    return {
      // API trả về: mảng slot đã được đặt + slot đang được giữ
      booked: booked.rows.map((r) => r.price_config_id),
      holding: holding.rows.map((r) => r.price_config_id),
    };
  } catch (e) {
    throw e;
  }
};

// Kiểm tra slot có đang được giữ
module.exports.holdSlots = async (
  stadium_id,
  date,
  price_config_id,
  socket_id,
) => {
  try {
    // Xóa những hold có expires_at < NOW()
    await pool.query(
      `
      DELETE
      FROM booking_holds
      WHERE expires_at < NOW()
      `,
    );

    // Tìm xem chính thiết bị/tài khoản này trc đấy đã giữ slot chưa để xóa
    // // Xóa đang giữ của thiết bị đấy khi chọn sang khung giờ khác chứ không để 10s mới bấm đc

    let oldHold;
    if (socket_id) {
      oldHold = await pool.query(
        `SELECT price_config_id FROM booking_holds 
       WHERE stadium_id = $1 AND booking_date = $2 AND socket_id = $3`,
        [stadium_id, date, socket_id],
      );
    }
    if (oldHold.rows.length > 0) {
      const oldSlotId = oldHold.rows[0].price_config_id;
      if (socket_id) {
        await pool.query(
          `DELETE FROM booking_holds
         WHERE price_config_id = $1 AND socket_id = $2`,
          [oldSlotId, socket_id],
        );
        // Báo cho frontend mở khóa slot nào
        io.to(`stadium-${stadium_id}`).emit("sold-released", {
          price_config_id: oldSlotId,
        });
        console.log(`Chạy đến đây: stadium-${stadium_id} `);
      }
    }

 

    // Kiểm tra slot đấy đã được booking chưa <ktra sân này, ngày này, giờ này>
    // Slot đã đặt rồi thì không cho giữ nữa
    const booked = await pool.query(
      `
        SELECT price_config_id 
        FROM bookings
        WHERE stadium_id = $1
        AND booking_date = $2
        AND price_config_id = $3
        AND status != 'cancelled'
        `,
      [stadium_id, date, price_config_id],
    );

    // Slot đã được đặt rồi thì không cho giữ nữa
    if (booked.rows.length) {
      throw new Error("Slot đã được đặt");
    }

    // TH slot chưa được đặt thì kiểm tra xem có ai đang giữ tạm thời không
    const holding = await pool.query(
      `
        SELECT id
        FROM booking_holds
        WHERE stadium_id = $1
        AND booking_date = $2
        AND price_config_id = $3
        AND expires_at > NOW()
    `,
      [stadium_id, date, price_config_id],
    );

    // Slot đang được giữ rồi thì dừng ở đây
    if (holding.rows.length) {
      throw new Error("Slot đang được giữ");
    }

    // Nếu slot đấy không được giữ
    await pool.query(
      `
    INSERT INTO booking_holds(
      stadium_id,
      booking_date,
      price_config_id,
      expires_at,
      socket_id
    )
    VALUES(
      $1,
      $2,
      $3,
      NOW() + INTERVAL '10 seconds',
      $4
    )
    `,
      [stadium_id, date, price_config_id, socket_id],
    );

    // Gửi event sold-held cho tất cả socket trong roomstadium-${stadium_id}
    io.to(`stadium-${stadium_id}`).emit("sold-held", {
      price_config_id,
    });

    setTimeout(async () => {
      // Xóa những hold có expires_at < NOW()
      await pool.query(
        `
      DELETE
      FROM booking_holds
      WHERE stadium_id = $1
      AND booking_date = $2
      AND price_config_id = $3
      `,
        [stadium_id, date, price_config_id],
      );

      // Sau phát ra sự kiện bỏ giữ
      io.to(`stadium-${stadium_id}`).emit("sold-released", {
        price_config_id,
      });
    }, 10000);

    // console.log("io mo", io.id);
    return {
      message: "success",
    };
  } catch (e) {
    throw e;
  }
};

// Chuyển trạng thái
module.exports.updateStatus = async (data) => {
  const { id, newStatus } = data;

  // Lấy Booking
  const bookingRes = await pool.query(
    `SELECT status FROM bookings WHERE id = $1`,
    [id],
  );

  if (bookingRes.rows.length === 0) {
    throw new AppError("Booking không tồn tại", 409);
  }
  const currentStatus = bookingRes.rows[0].status;

  // Check hợp lệ
  const allowedTransitions = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["playing", "cancelled"],
    playing: ["completed"],
    completed: [],
    cancelled: [],
  };

  if (!allowedTransitions[currentStatus].includes(newStatus)) {
    throw new AppError(`Không thể chuyển ${currentStatus} → ${newStatus}`, 409);
  }
  // 3. Update luôn
  await pool.query(
    `UPDATE bookings 
     SET status = $1
     WHERE id = $2`,
    [newStatus, id],
  );
  return {
    status: "OK",
    message: "Cập nhật thành công",
  };
};

// Cancel booking
module.exports.cancelBooking = async (id, userId) => {
  const bookingRes = await pool.query(`SELECT * FROM bookings WHERE id = $1`, [
    id,
  ]);

  // Kiểm tran có tồn tại booking
  if (bookingRes.rows.length === 0) {
    throw new AppError("Booking không tồn tại", 404);
  }

  const booking = bookingRes.rows[0];
  // Kiểm tra có phải chính user đấy hủy khoong
  if (booking.user_id !== userId) {
    throw new AppError("Không có quyền", 403);
  }

  // Chỉ hủy khi chưa đá
  if (!["pending", "confirmed"].includes(booking.status)) {
    throw new AppError("Không thể huỷ trạng thái này", 409);
  }

  // console.log(booking);

  // Chỉ cho hủy trước 1 tiếng khi đá
  // if ((new Date(booking.booking_date) - new Date()) / (1000 * 60) < 60) {
  //   throw new AppError("Chỉ được huỷ trước 1 tiếng", 409);
  // }

  // Xử lý hủy sân khi thanh toán = online
  let paymentStatus = booking.payment_status;
  if (booking.payment_status === "paid") {
    paymentStatus === "refunded";
  }
  await pool.query(
    `
    UPDATE bookings
    SET status = 'cancelled',
        payment_status = $1
    WHERE id = $2
    `,
    [paymentStatus, id],
  );
  return {
    status: "OK",
    message: "Huỷ sân thành công",
  };
};

// Lấy các booking của user
module.exports.getMyBookings = async (userId) => {
  const result = await pool.query(
    `
    SELECT 
      b.*,
      s.name AS stadium_name,
      s.address,
      s.type,
      pc.start_time,
      pc.end_time
    FROM bookings b
    JOIN stadiums s ON b.stadium_id = s.id
    JOIN price_configs pc ON b.price_config_id = pc.id
    WHERE b.user_id = $1
    ORDER BY b.created_at DESC
    `,
    [userId],
  );
  return {
    status: "OK",
    data: result.rows,
  };
};
