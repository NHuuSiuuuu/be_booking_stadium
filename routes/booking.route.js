const express = require("express");
const route = express.Router();

const BookingController = require("../controllers/bookings.controller");
const { authMiddleWare } = require("../middleware/auth.middleware");

route.post(`/create`, authMiddleWare, BookingController.create);

route.get(`/get`, authMiddleWare, BookingController.get);

route.get(`/success/:id`, authMiddleWare, BookingController.success);

route.get(`/booked-slots`, BookingController.bookedSlots);

route.get(`/hold-slot`, BookingController.holdSlots);

route.post("/update-status", authMiddleWare, BookingController.updateStatus);

route.post("/cancel/:id", authMiddleWare, BookingController.cancelBooking);

route.get("/my", authMiddleWare, BookingController.getMyBookings);

module.exports = route;
