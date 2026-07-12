const stadiumRoute = require("./stadium.route");
const districtRoute = require("./district.route");
const priceconfigRoute = require("./priceConfig.route");
const userRoute = require("./user.route");
const authRoute = require("./auth.route");
const bookingRoute = require("./booking.route");
const statisticsRoute = require("./statistics.route");

const reviewsRoute = require("./reviews.route");
const chatRoute = require("./chat.route");
const { adminMiddleWare } = require("../middleware/admin.middleware");

module.exports = (app) => {
  app.use("/api", stadiumRoute);

  app.use("/api/price-config", priceconfigRoute);

  app.use("/api", districtRoute);

  app.use("/api/user", userRoute);

  app.use("/api", authRoute);

  app.use("/api/booking", bookingRoute);

  app.use("/api/statistics", statisticsRoute);

  app.use("/api/reviews", reviewsRoute);

  app.use("/api/chat", chatRoute);

  
};
