const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

module.exports.generalAccessToken = async (payload) => {
  // console.log("payload", payload); //payload { id: '6970cba9278861bcd586d05d', role_id: '0123456789' }
  const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN, {
    expiresIn: "15m",
  });
  return accessToken;
};

module.exports.generalRefreshToken = async (payload) => {
  const refresh_token = jwt.sign(payload, process.env.REFRESH_TOKEN, {
    expiresIn: "7d",
  });
  return refresh_token;
};
