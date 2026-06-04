const { pool } = require("../pool");
const AppError = require("../utils/AppError");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

module.exports.get = async ({ filter, sort, limit, page, keyword }) => {
  try {
    // Limit
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;

    let whereSql = `FROM users WHERE 1=1`;
    let orderSql = ``;
    let values = [];
    let index = 1;

    if (filter) {
      const [key, value] = filter.split(":");
      whereSql += ` AND ${key} = $${index}`;
      values.push(value);
      index++;
    }

    if (sort) {
      const [key, value] = sort.split(":");
      console.log("value", value);
      // Các trường sort
      const allowedFields = {
        fullname: "fullname",
        created_at: "created_at",
      };
      const direction = value === "desc" ? "DESC" : "ASC";

      if (allowedFields[key]) {
        orderSql += ` ORDER BY ${key} ${direction}`;
      }
    } else {
      orderSql += ` ORDER BY fullname ASC `;
    }

    if (keyword && keyword.trim() !== "") {
      whereSql += ` AND (
      unaccent(fullname) ILIKE unaccent($${index})
      OR unaccent(email) ILIKE unaccent($${index})
    )`;
      values.push(`%${keyword.trim()}%`);
      index++;
    }

    let limitSql = ` LIMIT $${index}`;
    values.push(limitNumber);
    index++;

    // OFFSET - skip
    let offsetSql = ` OFFSET $${index}`;
    values.push((pageNumber - 1) * limitNumber);
    index++;


    const result = await pool.query(
      `
      SELECT*
      ${whereSql} ${orderSql} ${limitSql} ${offsetSql}
      `,
      values,
    );

    const totalUsers = await pool.query(
      `SELECT COUNT(*) AS total
   ${whereSql}
  `,
      values.slice(0, values.length - 2), // bỏ limit + offset
    );

    const total = totalUsers.rows[0].total;

    console.log("totalUsers", total);
    return {
      status: "OK",
      message: "success",

      result: result.rows,
      total: total,
      pageCurrent: pageNumber,
      totalPage: Math.ceil(total / limitNumber),
    };
  } catch (e) {
    throw e;
  }
};

module.exports.create = async ({ fullName, email, password, phone }) => {
  try {
    console.log(email);
    const checkUer = await pool.query(
      `
      SELECT email
      FROM users
      WHERE email='${email}'
      `,
    );

    if (checkUer.rows.length > 0) {
      throw {
        status: 409,
        message: "Email đã tồn tại",
      };
    }

    // Mã hóa mật khẩu
    const hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO users (fullName, email, password, phone)
      VALUES($1, $2, $3, $4)
      RETURNING*
      `,
      [fullName, email, hash, phone],
    );
    return {
      result: result.rows[0],
      message: "Đăng ký thành công",
    };
  } catch (e) {
    throw e;
  }
};

module.exports.createAdmin = async ({ fullName, email, password, phone }) => {
  try {
    console.log(email);
    const checkUer = await pool.query(
      `
      SELECT email
      FROM users
      WHERE email='${email}'
      `,
    );

    if (checkUer.rows.length > 0) {
      throw new AppError("Email đã tồn tại", 409);
    }

    // Mã hóa mật khẩu
    const hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO users (fullName, email, password, phone, isadmin)
      VALUES($1, $2, $3, $4, $5)
      RETURNING*
      `,
      [fullName, email, hash, phone, true],
    );
    return {
      result: result.rows[0],
      message: "Đăng ký thành công",
    };
  } catch (e) {
    throw e;
  }
};

module.exports.update = async ({ id }, data) => {
  try {
    const { fullName, email, password, phone } = data;

    // Kiểm tra có user này không
    const checkUer = await pool.query(
      `
      SELECT id
      FROM users
      WHERE id=$1
      `,
      [id],
    );

    if (checkUer.rows.length === 0) {
      throw {
        status: 404,
        message: "Email không tồn tại",
      };
    }

    // Kiểm tra emai trùng nếu user thay đổi email trùng với email của người khác
    if (email) {
      const checkEmail = await pool.query(
        `
      SELECT email
      FROM users
      WHERE email = $1 AND id != $2
        `,
        [email, id],
      );
      if (checkEmail.rows.length > 0) {
        throw {
          status: 409,
          message: "Email đã tồn tại",
        };
      }
    }
    // Mã hóa mật khẩu
    let hashPw = null;
    if (password) {
      hashPw = await bcrypt.hash(password, 10);
    }
    const result = await pool.query(
      `
      UPDATE users
      SET
        fullName=$1,
        email=$2,
        password=$3,
        phone=$4
      WHERE id=$5
      RETURNING*
      `,
      [fullName, email, hashPw, phone, id],
    );
    return {
      result: result.rows[0],
      message: "Cập nhật thành công",
    };
  } catch (e) {
    throw e;
  }
};

module.exports.delete = async ({ id }) => {
  try {
    console.log(id);
    const result = await pool.query(
      `
      DELETE 
      FROM users
      WHERE id= ${id}
      RETURNING*
      `,
    );
    return {
      result: result.rows[0],
      message: "Xóa thành công",
    };
  } catch (e) {
    throw e;
  }
};

module.exports.forgotPassword = async (data) => {
  try {
    const { email } = data;

    const userRes = await pool.query(`SELECT id FROM users WHERE email = $1`, [
      email,
    ]);

    if (userRes.rows.length === 0) {
      throw new AppError("Email không tồn tại!", 409);
    }

    const userId = userRes.rows[0].id;

    // Tạo OTP
    const otp = crypto.randomInt(0, 1000000).toString().padStart(6, "0");

    // Expire - hết hạn sai 5p
    const expire = new Date(Date.now() + 5 * 60 * 1000);

    // 4. Lưu DB
    await pool.query(
      `UPDATE users
     SET reset_otp = $1, reset_otp_expire = $2
     WHERE id = $3`,
      [otp, expire, userId],
    );

    // Gửi email OTp
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Mã OTP đặt lại mật khẩu",
      html: `
      <div style="font-family: 'Open Sans', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #000;">

        <div style="padding: 28px 32px; border-bottom: 1px solid #222;">
          <span style="color: white; font-size: 18px; font-weight: 800; letter-spacing: 6px; text-transform: uppercase;">SÂNBÓNGHN</span>
        </div>

        <div style="padding: 48px 32px;">
          <p style="color: #555; font-size: 10px; letter-spacing: 4px; text-transform: uppercase; margin: 0 0 20px; font-weight: 600;">Bảo mật tài khoản</p>
          <h1 style="color: white; font-size: 34px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.5px; margin: 0 0 20px; line-height: 1.15;">
            MÃ XÁC<br/>NHẬN CỦA<br/>BẠN
          </h1>
          <p style="color: #777; font-size: 13px; line-height: 1.8; margin: 0 0 40px; font-weight: 400;">
            Nhập mã bên dưới để đặt lại mật khẩu.<br/>Mã có hiệu lực trong <span style="color: white; font-weight: 600;">5 phút</span>.
          </p>

          <div style="background: white; padding: 28px; text-align: center; margin-bottom: 40px;">
            <p style="color: #999; font-size: 10px; letter-spacing: 3px; text-transform: uppercase; margin: 0 0 14px; font-weight: 600;">Mã OTP</p>
            <span style="font-size: 50px; font-weight: 800; letter-spacing: 14px; color: #000;">${otp}</span>
          </div>

          <p style="color: #444; font-size: 12px; line-height: 1.8; border-top: 1px solid #222; padding-top: 24px; font-weight: 400;">
            Không chia sẻ mã này với bất kỳ ai, kể cả nhân viên hỗ trợ.<br/>
            Nếu bạn không yêu cầu, hãy bỏ qua email này.
          </p>
        </div>

        <div style="padding: 20px 32px; border-top: 1px solid #222;">
          <span style="color: #333; font-size: 10px; letter-spacing: 3px; text-transform: uppercase; font-weight: 600;">© 2026 SÂNBÓNGHN</span>
        </div>
      </div>
`,
    });

    return {
      message: "OTP đã gửi",
    };
  } catch (e) {
    throw e;
  }
};

module.exports.resetPassword = async (data) => {
  try {
    const { email, otp, newPassword } = data;

    const userRes = await pool.query(
      `
      SELECT id 
      FROM users WHERE email = $1 
      AND reset_otp = $2
      AND reset_otp_expire > NOW()
      `,
      [email, otp],
    );

    if (userRes.rows.length === 0) {
      throw new AppError("OTP không hợp lệ hoặc đã hết hạn", 409);
    }

    // Mã hóa mật khẩu
    const hash = await bcrypt.hash(newPassword, 10);

    const userId = userRes.rows[0].id;

    // 4. Lưu DB
    await pool.query(
      `UPDATE users
       SET password = $1, reset_otp = NULL, reset_otp_expire = NULL
       WHERE id = $2`,
      [hash, userId],
    );

    return {
      message: "Cập nhật mật khẩu thành công",
    };
  } catch (e) {
    throw e;
  }
};
