const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const JwtService = require("../services/jwt.service");

dotenv.config();

module.exports.authMiddleWare = async (req, res, next) => {
  const access_token = req.cookies?.access_token;
  const refresh_token = req.cookies?.refresh_token;
  // console.log("access_token",access_token)
  // console.log("refresh_token",refresh_token)

  let decoded;

  if (access_token) {
    try {
      decoded = jwt.verify(access_token, process.env.ACCESS_TOKEN);
      req.user = decoded;
      return next();
    } catch (e) {
      console.log("Access token lỗi:", e.message);
    }
  }

  if (!refresh_token) {
    return next({
      status: 401,
      message: "Hết phiên đăng nhập",
    });
  }

  // Giải mã refresh
  try {
    const decodedRefresh = jwt.verify(refresh_token, process.env.REFRESH_TOKEN);

    //   Tạo access_token mới
    const newAccessToken = await JwtService.generalAccessToken({
      id: decodedRefresh.id,
      isAdmin: decodedRefresh.isAdmin,
    });

    // Xét lại cookie
    res.cookie("access_token", newAccessToken, {
      httpOnly: true, // Chặn truy cập từ JavaScript (bảo mật hơn)
      secure: false, // Chỉ gửi trên HTTPS (để đảm bảo an toàn)
      sameSite: "Lax", // Chống tấn công CSRF
      maxAge: 15 * 60 * 1000, // 15 phút
    });
    // Set lại refresh_token để gia hạn cookie
    res.cookie("refresh_token", refresh_token, {
      httpOnly: true,
      secure: false,
      sameSite: "Strict",
      maxAge: 365 * 24 * 60 * 60 * 1000, // 365 ngày
    });

    req.user = decodedRefresh;

    return next();
  } catch (e) {
    return next({
      status: 401,
      message: "Hết phiên đăng nhập",
    });
  }
};
