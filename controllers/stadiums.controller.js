const StadiumService = require("../services/stadiums.service");

module.exports.index = async (req, res) => {
  try {
    const stadiums = await StadiumService.index(req.query);
    console.log("QUERY DATABASE");
    return res.status(200).json(stadiums);
  } catch (e) {
    return res.status(500).json({
      message: e.message || e,
    });
  }
};

module.exports.create = async (req, res) => {
  try {
    const stadiums = await StadiumService.create(req.body);
    return res.status(200).json(stadiums);
  } catch (e) {
    return res.status(500).json({
      message: e.message || e,
    });
  }
};

module.exports.update = async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;
    console.log(id);
    console.log(data);
    const stadiums = await StadiumService.update(id, data);
    return res.status(200).json(stadiums);
  } catch (e) {
    return res.status(500).json({
      message: e.message || e,
    });
  }
};

module.exports.delete = async (req, res) => {
  try {
    const id = req.params.id;
    const stadiums = await StadiumService.delete(id);
    return res.status(200).json(stadiums);
  } catch (e) {
    return res.status(500).json({
      message: e.message || e,
    });
  }
};

module.exports.detail = async (req, res) => {
  try {
    const id = req.params.id;
    const stadiums = await StadiumService.detail(id);
    return res.status(200).json(stadiums);
  } catch (e) {
    return res.status(500).json({
      message: e.message || e,
    });
  }
};

module.exports.detailUser = async (req, res) => {
  try {
    const slug = req.params.slug;
    const stadiums = await StadiumService.detailUser(slug);
    return res.status(200).json(stadiums);
  } catch (e) {
    return res.status(500).json({
      message: e.message || e,
    });
  }
};
