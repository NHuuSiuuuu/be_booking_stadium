const PriceConfigService = require("../services/priceConfigs.service");

module.exports.create = async (req, res) => {
  try {
    const result = await PriceConfigService.create(req.body);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};

module.exports.update = async (req, res) => {
  try {
    const result = await PriceConfigService.update(req.body);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};

module.exports.delete = async (req, res) => {
  try {
    const id = req.params;
    const stadiums = await PriceConfigService.delete(id);
    return res.status(200).json(stadiums);
  } catch (e) {
    return res.status(500).json({
      message: e.message || e,
    });
  }
};

module.exports.getByStadium = async (req, res) => {
  try {
    const result = await PriceConfigService.getByStadium(req.params);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};
