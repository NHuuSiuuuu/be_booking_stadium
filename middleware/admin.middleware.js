module.exports.adminMiddleWare = (req, res, next) => {
  if (!req.user) {
    return next({ status: 401, message: "Chưa đăng nhập" });
  }
  if (req.user.isAdmin !== true) {
    return next({ status: 403, message: "Bạn không có quyền thao tác" });
  }

  return next();
};
