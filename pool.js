const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // connectionString: chuỗi kết nối với database thay vì viết như bên dưới thằng này viết 1 dòng như này thôi
  ssl: {
    rejectUnauthorized: false,
  },
});

// const pool = new Pool({
//   user: "postgres",
//   host: "localhost",
//   database: "stadium_gis",
//   password: "Admin",
//   port: "5432",
// });

module.exports = { pool };
