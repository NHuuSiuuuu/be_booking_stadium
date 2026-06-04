const express = require("express");
const route = express.Router();
const StatisticsController = require("../controllers/statistics.controller");

const { authMiddleWare } = require("../middleware/auth.middleware");

route.get(`/overview`, authMiddleWare, StatisticsController.overview);

route.get(
  `/revenue-by-month`,
  authMiddleWare,
  StatisticsController.revenueByMonth,
);

route.get(
  `/bookings-by-month`,
  authMiddleWare,
  StatisticsController.bookingByMonth,
);

route.get(`/top-stadiums`, authMiddleWare, StatisticsController.topStadiums);

module.exports = route;
