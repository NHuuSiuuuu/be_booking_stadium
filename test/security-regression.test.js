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
  assert.match(
    userRoutes,
    /router\.get\("\/detail\/:id",\s*authMiddleWare,\s*controller\.detail\s*\)/s,
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

test("human chat schema documents conversations and messages tables", () => {
  const schema = read("docs/database/user-admin-chat.sql");

  assert.match(schema, /CREATE TABLE IF NOT EXISTS conversations/);
  assert.match(schema, /user_id INTEGER NOT NULL REFERENCES users\(id\)/);
  assert.match(schema, /stadium_id INTEGER REFERENCES stadiums\(id\)/);
  assert.match(schema, /status VARCHAR\(20\) NOT NULL DEFAULT 'open'/);
  assert.match(schema, /admin_unread_count INTEGER NOT NULL DEFAULT 0/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS messages/);
  assert.match(
    schema,
    /conversation_id INTEGER NOT NULL REFERENCES conversations\(id\) ON DELETE CASCADE/,
  );
  assert.match(schema, /sender_role VARCHAR\(20\) NOT NULL/);
});

test("human chat routes are mounted with auth and kept separate from AI chat", () => {
  const routes = read("routes/conversation.route.js");
  const index = read("routes/index.route.js");
  const aiChat = read("routes/chat.route.js");

  assert.match(index, /app\.use\("\/api\/conversations",\s*conversationRoutes\)/);
  assert.match(routes, /router\.post\("\/",\s*authMiddleWare,\s*controller\.getOrCreate\)/);
  assert.match(routes, /router\.get\("\/",\s*authMiddleWare,\s*controller\.list\)/);
  assert.match(
    routes,
    /router\.get\("\/:id\/messages",\s*authMiddleWare,\s*controller\.getMessages\)/,
  );
  assert.match(
    routes,
    /router\.post\("\/:id\/messages",\s*authMiddleWare,\s*controller\.sendMessage\)/,
  );
  assert.match(
    routes,
    /router\.patch\("\/:id\/read",\s*authMiddleWare,\s*controller\.markRead\)/,
  );
  assert.match(
    routes,
    /router\.patch\("\/:id\/close",\s*authMiddleWare,\s*adminMiddleWare,\s*controller\.close\)/,
  );
  assert.match(aiChat, /route\.post\(`\/`,\s*ChatController\.chat\)/);
});

test("user detail endpoint returns one account through the user service", () => {
  const controller = read("controllers/user.controller.js");
  const service = read("services/user.service.js");

  assert.match(controller, /module\.exports\.detail\s*=\s*async\s*\(req,\s*res\)\s*=>/);
  assert.match(controller, /UserService\.detail\(id,\s*req\.user\)/);
  assert.match(service, /module\.exports\.detail\s*=\s*async\s*\(\{\s*id\s*\},\s*actor\)\s*=>/);
  assert.match(service, /canManageUser\(actor,\s*id\)/);
  assert.match(service, /SELECT id, fullname, email, phone, isadmin, status, created_at/);
  assert.match(service, /WHERE id = \$1/);
});

test("user management responses include account status and creation date", () => {
  const service = read("services/user.service.js");

  assert.match(service, /allowedFilters\s*=\s*\{[\s\S]*status:\s*"status"/);
  assert.match(service, /SELECT id, fullname, email, phone, isadmin, status, created_at/);
  assert.match(service, /RETURNING id, fullname, email, phone, isadmin, status, created_at/);
});

test("user update can change role and active status", () => {
  const service = read("services/user.service.js");

  assert.match(service, /const\s*\{\s*fullName,\s*email,\s*password,\s*phone,\s*isadmin,\s*status\s*\}\s*=\s*data/);
  assert.match(service, /isadmin = COALESCE\(\$5, isadmin\)/);
  assert.match(service, /status = COALESCE\(\$6, status\)/);
});

test("runtime config is read from environment instead of duplicated or hard-coded", () => {
  const index = read("index.js");
  assert.equal(/new Pool\(/.test(index), false, "index.js should reuse pool.js");

  const bookingService = read("services/bookings.service.js");
  assert.equal(/TQ3L35SC|WFGSQJSZYSC75J3BW7J7YFCB05V4DOT6/.test(bookingService), false);
  assert.match(bookingService, /process\.env\.VNPAY_TMN_CODE/);
  assert.match(bookingService, /process\.env\.VNPAY_SECURE_SECRET/);
});

test("booking creation does not wait for email delivery before responding", () => {
  const bookingService = read("services/bookings.service.js");

  assert.equal(
    /await\s+transporter\.sendMail/.test(bookingService),
    false,
    "booking create should not await SMTP email delivery after the booking is committed",
  );
  assert.match(bookingService, /transporter\s*\.\s*sendMail\([\s\S]*\.catch\(/);
});

test("cors allows normalized frontend origins and Vercel preview deployments", () => {
  const index = read("index.js");

  assert.match(index, /function normalizeOrigin/);
  assert.match(index, /function isAllowedCorsOrigin/);
  assert.match(index, /fe-booking-stadium/);
  assert.match(index, /booking-stadium\.vercel\.app/);
  assert.equal(index.includes("vercel\\.app"), true);
  assert.doesNotMatch(index, /origin:\s*process\.env\.REACT_APP_URL\s*\|\|\s*"\*"/);
});
