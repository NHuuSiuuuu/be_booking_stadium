const express = require("express");
const route = express.Router();
const StatisticsController = require("../controllers/statistics.controller");

const { authMiddleWare } = require("../middleware/auth.middleware");
const { adminMiddleWare } = require("../middleware/admin.middleware");

route.get(`/overview`, authMiddleWare, adminMiddleWare, StatisticsController.overview);

route.get(
  `/revenue-by-month`,
  authMiddleWare,
  adminMiddleWare,
  StatisticsController.revenueByMonth,
);

route.get(
  `/bookings-by-month`,
  authMiddleWare,
  adminMiddleWare,
  StatisticsController.bookingByMonth,
);

route.get(
  `/top-stadiums`,
  authMiddleWare,
  adminMiddleWare,
  StatisticsController.topStadiums,
);

route.get(
  `/status-summary`,
  authMiddleWare,
  adminMiddleWare,
  StatisticsController.statusSummary,
);

route.get(
  `/payment-summary`,
  authMiddleWare,
  adminMiddleWare,
  StatisticsController.paymentSummary,
);

route.get(
  `/bookings-export.csv`,
  authMiddleWare,
  adminMiddleWare,
  StatisticsController.bookingsExportCsv,
);

module.exports = route;
