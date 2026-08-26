const express = require("express");
const route = express.Router();

const controller = require("../controllers/auth.controller");
const BookingController = require("../controllers/bookings.controller");
const { authMiddleWare } = require("../middleware/auth.middleware");

route.post("/login", controller.login);
route.post("/logout", controller.logout);

route.get("/auth/me", authMiddleWare, controller.me);

route.get("/check-payment-vnpay", BookingController.checkPaymentVNPay);

module.exports = route;
