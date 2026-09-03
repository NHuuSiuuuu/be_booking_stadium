const UserService = require("../services/user.service");


module.exports.get = async (req, res) => {
  try {
    const result = await UserService.get(req.query);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};



module.exports.create = async (req, res) => {
  try {
    console.log("req.body",req.body)
    const result = await UserService.create(req.body);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};

module.exports.createAdmin = async (req, res) => {
  try {
    const result = await UserService.createAdmin(req.body);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};

module.exports.detail = async (req, res) => {
  try {
    const id = req.params;
    const result = await UserService.detail(id, req.user);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};

module.exports.update = async (req, res) => {
  try {
    const id = req.params;
    const data = req.body;
    const result = await UserService.update(id, data, req.user);
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
    const result = await UserService.delete(id, req.user);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};

module.exports.forgotPassword = async (req, res) => {
  try {
    const result = await UserService.forgotPassword(req.body);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};

module.exports.resetPassword = async (req, res) => {
  try {
    const result = await UserService.resetPassword(req.body);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};
