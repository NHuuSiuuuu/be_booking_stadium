const AuthService = require("../services/auth.service");
const { getAuthCookieOptions } = require("../utils/cookieOptions");

module.exports.login = async (req, res) => {
  try {
    const result = await AuthService.login(req.body);
    res
      .cookie(
        "access_token",
        result.access_token,
        getAuthCookieOptions({ maxAge: 15 * 60 * 1000 }),
      )
      .cookie(
        "refresh_token",
        result.refresh_token,
        getAuthCookieOptions({ maxAge: 7 * 24 * 60 * 60 * 1000 }),
      );

    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};

module.exports.logout = async (req, res) => {
  try {
    res
      .clearCookie("access_token", getAuthCookieOptions())
      .clearCookie("refresh_token", getAuthCookieOptions());

    return res.status(200).json({
      status: "OK",
      message: "Đăng xuất thành công",
    });
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};

module.exports.me = async (req, res) => {
  try {
    const id = req.user.id;

    const result = await AuthService.getMe(id);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};
