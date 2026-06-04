const DistrictService = require("../services/districts.service");

module.exports.index = async (req, res) => {
  try {
    const stadiums = await DistrictService.index();
    return res.status(200).json(stadiums);
  } catch (e) {
    return res.status(500).json({
      message: e.message || e,
    });
  }
};

