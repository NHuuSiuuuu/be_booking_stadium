const { pool } = require("../pool");

module.exports.index = async () => {
  try {
    const result = await pool.query(`
        SELECT ogc_fid, name_2
        FROM hanoi_districts
      `);
    return {
      message: "OK",
      districts: result.rows,
    };
  } catch (e) {
    throw e;
  }
};
