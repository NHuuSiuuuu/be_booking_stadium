const { Pool } = require("pg");
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "stadium_gis",
  password: "Admin",
  port: "5432",
});

module.exports = { pool };
