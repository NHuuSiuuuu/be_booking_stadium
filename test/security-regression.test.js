const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("database queries do not interpolate request-controlled values into SQL", () => {
  const checks = [
    ["services/auth.service.js", /WHERE email='\$\{email\}'/],
    ["services/user.service.js", /WHERE email='\$\{email\}'/],
    ["services/user.service.js", /AND \$\{key\} =/],
    ["services/user.service.js", /WHERE id= \$\{id\}/],
    ["services/priceConfigs.service.js", /WHERE id=\$\{id\}/],
    ["services/stadiums.service.js", /WHERE id=\$\{id\}/],
  ];

  for (const [file, pattern] of checks) {
    assert.equal(pattern.test(read(file)), false, `${file} still contains ${pattern}`);
  }
});

test("sensitive routes require authentication and admin authorization", () => {
  const userRoutes = read("routes/user.route.js");
  assert.match(
    userRoutes,
    /router\.post\("\/create-admin",\s*authMiddleWare,\s*adminMiddleWare,\s*controller\.createAdmin\s*\)/s,
  );

  const priceRoutes = read("routes/priceConfig.route.js");
  assert.match(
    priceRoutes,
    /router\.post\("\/create",\s*authMiddleWare,\s*adminMiddleWare,\s*controller\.create\s*\)/s,
  );
  assert.match(
    priceRoutes,
    /router\.patch\("\/update",\s*authMiddleWare,\s*adminMiddleWare,\s*controller\.update\s*\)/s,
  );

  const chatRoutes = read("routes/chat.route.js");
  assert.match(
    chatRoutes,
    /route\.get\(`\/index`,\s*authMiddleWare,\s*adminMiddleWare,\s*ChatController\.index\s*\)/s,
  );
  assert.match(
    chatRoutes,
    /route\.post\(`\/update-docs-stadium\/:stadiumId`,\s*authMiddleWare,\s*adminMiddleWare,\s*ChatController\.updateDocument\s*\)/s,
  );
});

test("runtime config is read from environment instead of duplicated or hard-coded", () => {
  const index = read("index.js");
  assert.equal(/new Pool\(/.test(index), false, "index.js should reuse pool.js");

  const bookingService = read("services/bookings.service.js");
  assert.equal(/TQ3L35SC|WFGSQJSZYSC75J3BW7J7YFCB05V4DOT6/.test(bookingService), false);
  assert.match(bookingService, /process\.env\.VNPAY_TMN_CODE/);
  assert.match(bookingService, /process\.env\.VNPAY_SECURE_SECRET/);
});
