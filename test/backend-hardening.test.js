const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("auth cookies use cross-site secure options in production and local-friendly options otherwise", () => {
  const { getAuthCookieOptions } = require("../utils/cookieOptions");

  const accessProduction = getAuthCookieOptions({ maxAge: 1, env: "production" });
  assert.equal(accessProduction.httpOnly, true);
  assert.equal(accessProduction.secure, true);
  assert.equal(accessProduction.sameSite, "none");
  assert.equal(accessProduction.path, "/");

  const accessLocal = getAuthCookieOptions({ maxAge: 1, env: "development" });
  assert.equal(accessLocal.httpOnly, true);
  assert.equal(accessLocal.secure, false);
  assert.equal(accessLocal.sameSite, "lax");
  assert.equal(accessLocal.path, "/");
});

test("user update and delete enforce owner-or-admin authorization", () => {
  const controller = read("controllers/user.controller.js");
  const service = read("services/user.service.js");

  assert.match(controller, /UserService\.update\(id,\s*data,\s*req\.user\)/);
  assert.match(controller, /UserService\.delete\(id,\s*req\.user\)/);
  assert.match(service, /function\s+canManageUser/);
  assert.match(service, /actor\.isAdmin\s*===\s*true/);
  assert.match(service, /String\(actor\.id\)\s*===\s*String\(targetUserId\)/);
  assert.match(service, /throw\s+new\s+AppError\("Không có quyền"/);
});

test("vnpay return route verifies signed return data before updating booking payment state", () => {
  const route = read("routes/auth.route.js");
  const service = read("services/bookings.service.js");

  assert.doesNotMatch(route, /"\/check-payment-vnpay",\s*authMiddleWare/);
  assert.match(route, /BookingController\.checkPaymentVNPay/);
  assert.match(service, /verifyReturnUrl\(query\)/);
  assert.match(service, /isVerified/);
  assert.match(service, /isSuccess/);
  assert.match(service, /payment_method = 'online'/);
  assert.match(service, /payment_status = 'unpaid'/);
  assert.match(service, /status = 'pending'/);
});

test("cancelled vnpay returns mark online bookings as failed payments", () => {
  const service = read("services/bookings.service.js");

  assert.match(service, /verification\.isSuccess/);
  assert.match(service, /SET status = 'cancelled',\s*payment_status = 'failed'/);
  assert.match(service, /AND payment_method = 'online'/);
  assert.match(service, /AND payment_status = 'unpaid'/);
  assert.match(service, /AND status = 'pending'/);
});

test("reviews can only be created for completed bookings owned by the user", () => {
  const service = read("services/reviews.service.js");

  assert.match(service, /booking\.user_id !== userId/);
  assert.match(service, /booking\.status !== "completed"/);
  assert.match(service, /Chỉ được đánh giá sau khi hoàn thành/);
});

test("online booking validates vnpay configuration before committing booking", () => {
  const service = read("services/bookings.service.js");

  const configCheckIndex = service.indexOf("validateVNPayConfig");
  const beginIndex = service.indexOf('client.query("BEGIN")');
  const commitIndex = service.indexOf('client.query("COMMIT")');
  const buildPaymentIndex = service.indexOf("buildPaymentUrl");

  assert.notEqual(configCheckIndex, -1);
  assert.ok(configCheckIndex < beginIndex);
  assert.ok(commitIndex < buildPaymentIndex);
});

test("holding a slot is protected by a transaction lock and timeout deletes only the created hold", () => {
  const service = read("services/bookings.service.js");

  assert.match(service, /SELECT pg_advisory_xact_lock\(hashtext\(\$1\)\)/);
  assert.match(service, /client\.query\("BEGIN"\)/);
  assert.match(service, /RETURNING id/);
  assert.match(service, /const holdId = holdResult\.rows\[0\]\.id/);
  assert.match(service, /WHERE id = \$1\s+AND expires_at <= NOW\(\)/);
});

test("human chat service derives sender role and restricts user access", () => {
  const service = read("services/conversations.service.js");

  assert.match(service, /function\s+getSenderRole\(actor\)/);
  assert.match(service, /actor\.isAdmin\s*===\s*true\s*\?\s*"admin"\s*:\s*"user"/);
  assert.match(service, /function\s+canReadConversation\(actor,\s*conversation\)/);
  assert.match(service, /actor\.isAdmin\s*===\s*true/);
  assert.match(service, /String\(conversation\.user_id\)\s*===\s*String\(actor\.id\)/);
  assert.match(service, /function\s+validateContent\(content\)/);
  assert.match(service, /trim\(\)/);
  assert.doesNotMatch(service, /sender_role\s*=\s*req\.body/);
});

test("socket chat events use dedicated chat rooms and do not reuse booking events", () => {
  const index = read("index.js");
  const service = read("services/conversations.service.js");

  assert.match(index, /chat:join-conversation/);
  assert.match(index, /conversation:\$\{conversationId\}/);
  assert.match(index, /chat:join-admin/);
  assert.match(index, /admin:messages/);
  assert.match(service, /global\.io/);
  assert.match(service, /chat:message-created/);
  assert.match(service, /chat:conversation-updated/);
});

test("socket chat rooms require authenticated users with conversation access", () => {
  const index = read("index.js");

  assert.match(index, /function\s+getSocketUser\(socket\)/);
  assert.match(index, /jwt\.verify\(\s*token/);
  assert.match(index, /async function\s+canSocketJoinConversation/);
  assert.match(index, /SELECT user_id\s+FROM conversations\s+WHERE id = \$1/);
  assert.match(index, /String\(result\.rows\[0\]\?\.user_id\)\s*===\s*String\(user\.id\)/);
  assert.match(index, /socket\.data\.user\?\.isAdmin\s*!==\s*true/);
  assert.match(index, /socket\.emit\("chat:error",\s*\{\s*message:\s*"Không có quyền"\s*\}\)/);
});

test("chat socket auth supports a short-lived token from an authenticated REST route", () => {
  const route = read("routes/conversation.route.js");
  const controller = read("controllers/conversations.controller.js");
  const index = read("index.js");

  assert.match(
    route,
    /router\.post\("\/socket-token",\s*authMiddleWare,\s*controller\.createSocketToken\)/,
  );
  assert.match(controller, /module\.exports\.createSocketToken/);
  assert.match(controller, /jwt\.sign\(/);
  assert.match(controller, /expiresIn:\s*"5m"/);
  assert.match(index, /socket\.handshake\.auth\?\.token/);
  assert.match(index, /process\.env\.ACCESS_TOKEN/);
});

test("chat socket forwards typing state without persisting it", () => {
  const index = read("index.js");
  const service = read("services/conversations.service.js");

  assert.match(index, /chat:typing/);
  assert.match(index, /chat:stop-typing/);
  assert.match(index, /getSocketSenderRole\(socket\)/);
  assert.match(index, /canSocketJoinConversation\(socket,\s*conversationId\)/);
  assert.match(index, /socket\.to\(`conversation:\$\{conversationId\}`\)\.emit\("chat:typing"/);
  assert.match(index, /global\.io\.to\("admin:messages"\)\.emit\("chat:typing"/);
  assert.doesNotMatch(service, /chat:typing/);
  assert.doesNotMatch(service, /chat:stop-typing/);
});

test("human chat realtime updates include user and stadium metadata", () => {
  const service = read("services/conversations.service.js");

  assert.match(service, /async function\s+getConversationDetail\(conversationId\)/);
  assert.match(service, /u\.fullname AS user_fullname/);
  assert.match(service, /s\.name AS stadium_name/);
  assert.match(service, /const updatedConversation = await getConversationDetail\(conversationId\)/);
  assert.match(service, /emitMessageCreated\(conversationId,\s*message,\s*updatedConversation\)/);
});

test("human chat reuses one conversation per user and updates stadium context", async () => {
  const queries = [];
  const existingConversation = {
    id: 9,
    user_id: 7,
    stadium_id: 1,
    status: "open",
    last_message: "old",
    last_message_at: null,
    user_unread_count: 0,
    admin_unread_count: 0,
    created_at: "2026-09-04T00:00:00Z",
    updated_at: "2026-09-04T00:00:00Z",
    stadium_name: "Sân cũ",
    stadium_slug: "san-cu",
  };
  const updatedConversation = {
    ...existingConversation,
    stadium_id: 2,
    stadium_name: "Sân mới",
    stadium_slug: "san-moi",
  };
  const pool = {
    query: async (sql, values) => {
      queries.push({ sql, values });

      if (/FROM stadiums\s+WHERE id = \$1/.test(sql)) {
        return { rows: [{ id: values[0] }] };
      }

      if (/FROM conversations c/.test(sql) && /WHERE c.user_id = \$1/.test(sql)) {
        return { rows: [existingConversation] };
      }

      if (/UPDATE conversations\s+SET stadium_id = \$1/.test(sql)) {
        return { rows: [updatedConversation] };
      }

      if (/FROM conversations c/.test(sql) && /WHERE c.id = \$1/.test(sql)) {
        return { rows: [updatedConversation] };
      }

      return { rows: [] };
    },
  };

  const poolPath = require.resolve("../pool");
  const servicePath = require.resolve("../services/conversations.service");
  const previousPool = require.cache[poolPath];
  delete require.cache[servicePath];
  require.cache[poolPath] = {
    id: poolPath,
    filename: poolPath,
    loaded: true,
    exports: { pool },
  };

  try {
    const ConversationService = require("../services/conversations.service");
    const result = await ConversationService.getOrCreate({
      userId: 7,
      stadiumId: 2,
    });

    assert.equal(result.id, 9);
    assert.equal(result.stadium_id, 2);
    assert.equal(
      queries.some((query) => /INSERT INTO conversations/.test(query.sql)),
      false,
    );
    assert.equal(
      queries.some((query) => /WHERE c.user_id = \$1 AND c.stadium_id = \$2/.test(query.sql)),
      false,
    );
    assert.equal(
      queries.some(
        (query) =>
          /UPDATE conversations\s+SET stadium_id = \$1/.test(query.sql) &&
          query.values?.[0] === 2 &&
          query.values?.[1] === 9,
      ),
      true,
    );
  } finally {
    delete require.cache[servicePath];
    if (previousPool) {
      require.cache[poolPath] = previousPool;
    } else {
      delete require.cache[poolPath];
    }
  }
});

test("admin conversation delete hides the thread without deleting user history", () => {
  const service = read("services/conversations.service.js");
  const schema = read("docs/database/user-admin-chat.sql");

  assert.match(schema, /admin_hidden_at TIMESTAMP/);
  assert.match(
    schema,
    /ALTER TABLE conversations\s+ADD COLUMN IF NOT EXISTS admin_hidden_at TIMESTAMP/,
  );
  assert.match(service, /c\.admin_hidden_at IS NULL/);
  assert.match(
    service,
    /admin_hidden_at = CASE WHEN \$2 = 'user' THEN NULL ELSE admin_hidden_at END/,
  );
  assert.match(service, /UPDATE conversations\s+SET admin_hidden_at = NOW\(\)/);
  assert.doesNotMatch(
    service,
    /DELETE FROM conversations\s+WHERE id = \$1\s+RETURNING id/,
  );
});

test("holdSlots succeeds with no previous hold and schedules cleanup for the created hold", async () => {
  const queries = [];
  const client = {
    query: async (sql, values) => {
      queries.push({ sql, values });

      if (/SELECT price_config_id FROM booking_holds/.test(sql)) {
        return { rows: [] };
      }

      if (/FROM bookings/.test(sql)) {
        return { rows: [] };
      }

      if (/FROM booking_holds/.test(sql) && /expires_at > NOW/.test(sql)) {
        return { rows: [] };
      }

      if (/INSERT INTO booking_holds/.test(sql)) {
        return { rows: [{ id: "hold-1" }] };
      }

      return { rows: [], rowCount: 0 };
    },
    release: () => {
      queries.push({ sql: "RELEASE" });
    },
  };
  const pool = {
    connect: async () => client,
    query: async (sql, values) => {
      queries.push({ sql, values });
      return { rows: [], rowCount: 1 };
    },
  };
  const emitted = [];
  global.io = {
    to: (room) => ({
      emit: (event, payload) => emitted.push({ room, event, payload }),
    }),
  };

  const originalSetTimeout = global.setTimeout;
  let cleanupCallback;
  global.setTimeout = (callback) => {
    cleanupCallback = callback;
    return 1;
  };

  const poolPath = require.resolve("../pool");
  const servicePath = require.resolve("../services/bookings.service");
  const previousPool = require.cache[poolPath];
  delete require.cache[servicePath];
  require.cache[poolPath] = {
    id: poolPath,
    filename: poolPath,
    loaded: true,
    exports: { pool },
  };

  try {
    const BookingService = require("../services/bookings.service");
    const result = await BookingService.holdSlots(
      "stadium-1",
      "2026-08-26",
      "slot-1",
      "socket-1",
    );

    assert.deepEqual(result, { message: "success" });
    assert.deepEqual(emitted, [
      {
        room: "stadium-stadium-1",
        event: "sold-held",
        payload: { price_config_id: "slot-1" },
      },
    ]);
    assert.equal(typeof cleanupCallback, "function");

    await cleanupCallback();
    assert.equal(
      queries.some(
        (query) =>
          /WHERE id = \$1/.test(query.sql) &&
          query.values?.[0] === "hold-1",
      ),
      true,
    );
  } finally {
    global.setTimeout = originalSetTimeout;
    delete global.io;
    delete require.cache[servicePath];
    if (previousPool) {
      require.cache[poolPath] = previousPool;
    } else {
      delete require.cache[poolPath];
    }
  }
});
