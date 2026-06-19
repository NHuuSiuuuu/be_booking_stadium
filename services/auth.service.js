const { pool } = require("../pool");
// const AppError = require("../config/")
const bcrypt = require("bcrypt");
const jwtService = require("../services/jwt.service");

module.exports.login = async ({ email, password }) => {
  try {
    console.log(email);
    const checkUer = await pool.query(
      `
      SELECT password ,isAdmin, id
      FROM users
      WHERE email='${email}'
      `,
    );

    if (checkUer.rows.length === 0) {
      throw {
        status: 404,
        message: "Email không tồn tại",
      };
    }
    // So sánh pw
    const comparePassword = await bcrypt.compare(
      password,
      checkUer.rows[0].password,
    );
    if (!comparePassword) {
      throw {
        status: 400,
        message: "Mật khẩu không đúng",
      };
    }

    const access_token = await jwtService.generalAccessToken({
      id: checkUer.rows[0].id,
      isAdmin: checkUer.rows[0].isadmin,
    });

    const refresh_token = await jwtService.generalRefreshToken({
      id: checkUer.rows[0].id,
      isAdmin: checkUer.rows[0].isadmin,
    });

    return {
      status: "OK",
      message: "SUCCESS",
      access_token: access_token,
      refresh_token: refresh_token,
    };
  } catch (e) {
    throw e;
  }
};

module.exports.getMe = async (id) => {
  try {
    const result = await pool.query(
      `
      SELECT id, fullname, email, isadmin, phone
      FROM users
      WHERE id = $1
      `,
      [id],
    );
    // console.log("id là", result.rows[0]);
    return {
      user: {
        id: result.rows[0].id,
        fullname: result.rows[0].fullname,
        email: result.rows[0].email,
        isAdmin: result.rows[0].isadmin,
        phone: result.rows[0].phone,
      },
    };
  } catch (e) {
    throw e;
  }
};
