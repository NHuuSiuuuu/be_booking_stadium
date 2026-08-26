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
