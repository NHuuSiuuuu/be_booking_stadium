const StatisticService = require("../services/statistics.service");

// Tổng lượt đặt sân tháng này
// Tổng doanh thu tháng này
// Doanh thu trung bình tháng này
module.exports.overview = async (req, res) => {
  try {
    // console.log("req", req.query)
    const result = await StatisticService.overview();
    return res.status(201).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};

// API doanh thu theo 12 tháng gần nhất
module.exports.revenueByMonth = async (req, res) => {
  try {
    // console.log("req", req.query)
    const result = await StatisticService.revenueByMonth();
    return res.status(201).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};


// API lượt đặt theo tháng
module.exports.bookingByMonth = async (req, res) => {
  try {
    // console.log("req", req.query)
    const result = await StatisticService.bookingByMonth();
    return res.status(201).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};


// API top sân đặt nhiều
module.exports.topStadiums = async (req, res) => {
  try {
    // console.log("req", req.query)
    const result = await StatisticService.topStadiums();
    return res.status(201).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};

