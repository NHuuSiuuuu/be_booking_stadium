const assert = require("node:assert/strict");
const test = require("node:test");

test("mail transport uses explicit SMTP settings suitable for production networks", () => {
  const originalEnv = { ...process.env };
  process.env.EMAIL_USER = "sender@example.com";
  process.env.EMAIL_PASSWORD = "app-password";
  delete process.env.EMAIL_HOST;
  delete process.env.EMAIL_PORT;
  delete process.env.EMAIL_SECURE;

  delete require.cache[require.resolve("../services/mail.service")];
  const { getMailTransportOptions } = require("../services/mail.service");

  try {
    assert.deepEqual(getMailTransportOptions(), {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      requireTLS: true,
      family: 4,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      auth: {
        user: "sender@example.com",
        pass: "app-password",
      },
    });
  } finally {
    process.env = originalEnv;
  }
});
