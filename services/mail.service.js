const nodemailer = require("nodemailer");

function parseBoolean(value, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }
  return value === "true";
}

function parseNumber(value, defaultValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function isMailConfigured() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);
}

function getMailTransportOptions() {
  const port = parseNumber(process.env.EMAIL_PORT, 587);
  const secure = parseBoolean(process.env.EMAIL_SECURE, port === 465);

  return {
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port,
    secure,
    requireTLS: parseBoolean(process.env.EMAIL_REQUIRE_TLS, !secure),
    family: parseNumber(process.env.EMAIL_FAMILY, 4),
    connectionTimeout: parseNumber(process.env.EMAIL_CONNECTION_TIMEOUT, 10000),
    greetingTimeout: parseNumber(process.env.EMAIL_GREETING_TIMEOUT, 10000),
    socketTimeout: parseNumber(process.env.EMAIL_SOCKET_TIMEOUT, 20000),
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  };
}

function createMailTransporter() {
  return nodemailer.createTransport(getMailTransportOptions());
}

module.exports = {
  createMailTransporter,
  getMailTransportOptions,
  isMailConfigured,
};
