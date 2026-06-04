const { pool } = require("../pool");

module.exports.index = async () => {
  try {
    const result = await pool.query(`
        SELECT ogc_fid,name_2,
        ST_AsGeoJSON(wkb_geometry) as geom
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
