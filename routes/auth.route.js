const express = require("express");
const route = express.Router();

const controller = require("../controllers/auth.controller");
const { adminMiddleWare } = require("../middleware/admin.middleware");
const { authMiddleWare } = require("../middleware/auth.middleware");
const { pool } = require("../pool");

route.post("/login", controller.login);
route.post("/logout", controller.logout);

route.get("/auth/me", authMiddleWare, controller.me);

route.get("/check-payment-vnpay", authMiddleWare, async (req, res) => {
  // console.log("co di qua day")
  const vnp_TxnRef = req.query.vnp_TxnRef;
  const vnp_ResponseCode = req.query.vnp_ResponseCode;

  const booking = await pool.query(
    `
        SELECT* 
        FROM bookings
        WHERE id = $1
        `,
    [vnp_TxnRef],
  );

  // Kiểm tra lại order
  console.log("booking", booking.rows[0]);

  // Cập nhật lại trạng thái: Đã thanh toán
  if (vnp_ResponseCode === "00") {
    await pool.query(
      `
        UPDATE bookings
        SET payment_status = 'paid'
        WHERE id = $1
        `,
      [vnp_TxnRef],
    );
    return res.redirect(`http://localhost:5173/booking/success/${vnp_TxnRef}`);
  } else if (vnp_ResponseCode === "24") {
    console.log("Hủy thanh toán");
    // return res.redirect(`/cart`);
  } else {
    await pool.query(
      `
      UPDATE bookings
      SET status = 'cancelled'
      WHERE id = $1
      `,
      [vnp_TxnRef],
    );
  }

  console.log("req.query", req.query);
});

module.exports = route;
