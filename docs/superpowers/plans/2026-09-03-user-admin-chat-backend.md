# User Admin Chat Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build persisted realtime chat APIs so users can message the shared admin group about stadiums.

**Architecture:** Add a new conversations module beside the existing AI chatbot module. REST APIs validate auth and persist messages first, then Socket.IO emits realtime updates to conversation and admin rooms.

**Tech Stack:** Express 5, CommonJS, PostgreSQL through `pg`, Socket.IO, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-03-user-admin-chat-design.md`

## Global Constraints

- Existing AI chatbot endpoints in `routes/chat.route.js` and `controllers/chat.controller.js` must remain separate.
- All human chat endpoints require `authMiddleWare`.
- Admin list/read access covers all conversations because admins are a shared owner group.
- User list/read/send access is limited to conversations where `user_id = req.user.id`.
- Sender role is derived from `req.user.isAdmin`; it is never trusted from request body.
- SQL must be parameterized.
- Socket events must use the `chat:*` prefix and must not reuse booking slot event names.

---

## File Structure

- Create `docs/database/user-admin-chat.sql`: schema SQL for manual deployment because the repo has no migration runner.
- Create `routes/conversation.route.js`: Express routes for conversation APIs.
- Create `controllers/conversations.controller.js`: request/response layer.
- Create `services/conversations.service.js`: validation, authorization, and SQL.
- Modify `routes/index.route.js`: mount `/api/conversations`.
- Modify `index.js`: add Socket.IO room join/leave handlers for chat.
- Modify `test/security-regression.test.js`: route/auth/separation regression checks.
- Modify `test/backend-hardening.test.js`: service and socket contract checks.

---

### Task 1: Schema Contract

**Files:**
- Create: `docs/database/user-admin-chat.sql`
- Test: `test/security-regression.test.js`

**Interfaces:**
- Produces tables: `conversations`, `messages`
- Produces columns later services rely on: `user_id`, `stadium_id`, `status`, `last_message`, `last_message_at`, `user_unread_count`, `admin_unread_count`, `sender_id`, `sender_role`, `content`, `read_at`, `created_at`

- [ ] **Step 1: Write the failing test**

Add this test to `test/security-regression.test.js`:

```js
test("human chat schema documents conversations and messages tables", () => {
  const schema = read("docs/database/user-admin-chat.sql");

  assert.match(schema, /CREATE TABLE IF NOT EXISTS conversations/);
  assert.match(schema, /user_id INTEGER NOT NULL REFERENCES users\(id\)/);
  assert.match(schema, /stadium_id INTEGER REFERENCES stadiums\(id\)/);
  assert.match(schema, /status VARCHAR\(20\) NOT NULL DEFAULT 'open'/);
  assert.match(schema, /admin_unread_count INTEGER NOT NULL DEFAULT 0/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS messages/);
  assert.match(schema, /conversation_id INTEGER NOT NULL REFERENCES conversations\(id\) ON DELETE CASCADE/);
  assert.match(schema, /sender_role VARCHAR\(20\) NOT NULL/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/security-regression.test.js`

Expected: FAIL because `docs/database/user-admin-chat.sql` does not exist.

- [ ] **Step 3: Write minimal schema**

Create `docs/database/user-admin-chat.sql`:

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  stadium_id INTEGER REFERENCES stadiums(id),
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  last_message TEXT,
  last_message_at TIMESTAMP,
  user_unread_count INTEGER NOT NULL DEFAULT 0,
  admin_unread_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT conversations_status_check CHECK (status IN ('open', 'closed')),
  CONSTRAINT conversations_user_stadium_unique UNIQUE (user_id, stadium_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  sender_role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT messages_sender_role_check CHECK (sender_role IN ('user', 'admin')),
  CONSTRAINT messages_content_not_empty CHECK (char_length(trim(content)) > 0)
);

CREATE INDEX IF NOT EXISTS conversations_user_id_idx ON conversations(user_id);
CREATE INDEX IF NOT EXISTS conversations_stadium_id_idx ON conversations(stadium_id);
CREATE INDEX IF NOT EXISTS conversations_last_message_at_idx ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS messages_conversation_id_created_at_idx ON messages(conversation_id, created_at ASC);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/security-regression.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/database/user-admin-chat.sql test/security-regression.test.js
git commit -m "docs: add user admin chat schema"
```

---

### Task 2: Conversation Routes And Service

**Files:**
- Create: `routes/conversation.route.js`
- Create: `controllers/conversations.controller.js`
- Create: `services/conversations.service.js`
- Modify: `routes/index.route.js`
- Test: `test/security-regression.test.js`

**Interfaces:**
- Consumes tables from Task 1.
- Produces service methods:
  - `getOrCreate({ userId, stadiumId })`
  - `list(actor)`
  - `getMessages(conversationId, actor)`
  - `sendMessage(conversationId, actor, content)`
  - `markRead(conversationId, actor)`
  - `close(conversationId, actor)`

- [ ] **Step 1: Write the failing test**

Add this test to `test/security-regression.test.js`:

```js
test("human chat routes are mounted with auth and kept separate from AI chat", () => {
  const routes = read("routes/conversation.route.js");
  const index = read("routes/index.route.js");
  const aiChat = read("routes/chat.route.js");

  assert.match(index, /app\.use\("\/api\/conversations",\s*conversationRoutes\)/);
  assert.match(routes, /router\.post\("\/",\s*authMiddleWare,\s*controller\.getOrCreate\)/);
  assert.match(routes, /router\.get\("\/",\s*authMiddleWare,\s*controller\.list\)/);
  assert.match(routes, /router\.get\("\/:id\/messages",\s*authMiddleWare,\s*controller\.getMessages\)/);
  assert.match(routes, /router\.post\("\/:id\/messages",\s*authMiddleWare,\s*controller\.sendMessage\)/);
  assert.match(routes, /router\.patch\("\/:id\/read",\s*authMiddleWare,\s*controller\.markRead\)/);
  assert.match(routes, /router\.patch\("\/:id\/close",\s*authMiddleWare,\s*adminMiddleWare,\s*controller\.close\)/);
  assert.match(aiChat, /route\.post\(`\/`,\s*ChatController\.chat\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/security-regression.test.js`

Expected: FAIL because conversation route files are missing.

- [ ] **Step 3: Create route/controller/service skeleton**

Create `routes/conversation.route.js`:

```js
const express = require("express");
const router = express.Router();
const controller = require("../controllers/conversations.controller");
const { authMiddleWare } = require("../middleware/auth.middleware");
const { adminMiddleWare } = require("../middleware/admin.middleware");

router.post("/", authMiddleWare, controller.getOrCreate);
router.get("/", authMiddleWare, controller.list);
router.get("/:id/messages", authMiddleWare, controller.getMessages);
router.post("/:id/messages", authMiddleWare, controller.sendMessage);
router.patch("/:id/read", authMiddleWare, controller.markRead);
router.patch("/:id/close", authMiddleWare, adminMiddleWare, controller.close);

module.exports = router;
```

Create `controllers/conversations.controller.js`:

```js
const ConversationService = require("../services/conversations.service");

module.exports.getOrCreate = async (req, res, next) => {
  try {
    const result = await ConversationService.getOrCreate({
      userId: req.user.id,
      stadiumId: req.body.stadium_id,
    });
    res.json({ message: "success", result });
  } catch (err) {
    next(err);
  }
};

module.exports.list = async (req, res, next) => {
  try {
    const result = await ConversationService.list(req.user);
    res.json({ message: "success", result });
  } catch (err) {
    next(err);
  }
};

module.exports.getMessages = async (req, res, next) => {
  try {
    const result = await ConversationService.getMessages(req.params.id, req.user);
    res.json({ message: "success", result });
  } catch (err) {
    next(err);
  }
};

module.exports.sendMessage = async (req, res, next) => {
  try {
    const result = await ConversationService.sendMessage(
      req.params.id,
      req.user,
      req.body.content,
    );
    res.json({ message: "success", result });
  } catch (err) {
    next(err);
  }
};

module.exports.markRead = async (req, res, next) => {
  try {
    const result = await ConversationService.markRead(req.params.id, req.user);
    res.json({ message: "success", result });
  } catch (err) {
    next(err);
  }
};

module.exports.close = async (req, res, next) => {
  try {
    const result = await ConversationService.close(req.params.id, req.user);
    res.json({ message: "success", result });
  } catch (err) {
    next(err);
  }
};
```

Create `services/conversations.service.js` with exported method names and parameterized SQL. Implement the exact behavior in Task 3 and Task 4.

Modify `routes/index.route.js`:

```js
const conversationRoutes = require("./conversation.route");

app.use("/api/conversations", conversationRoutes);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/security-regression.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add routes/conversation.route.js controllers/conversations.controller.js services/conversations.service.js routes/index.route.js test/security-regression.test.js
git commit -m "feat: add conversation route skeleton"
```

---

### Task 3: Authorization And Persistence

**Files:**
- Modify: `services/conversations.service.js`
- Test: `test/backend-hardening.test.js`

**Interfaces:**
- Consumes service methods from Task 2.
- Produces authorization helpers:
  - `canReadConversation(actor, conversation)`
  - `getSenderRole(actor)`
  - `validateContent(content)`

- [ ] **Step 1: Write the failing test**

Add this test to `test/backend-hardening.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/backend-hardening.test.js`

Expected: FAIL until helpers exist.

- [ ] **Step 3: Implement service persistence**

Implement `services/conversations.service.js` with these helpers:

```js
const { pool } = require("../pool");
const AppError = require("../utils/AppError");

function getSenderRole(actor) {
  return actor.isAdmin === true ? "admin" : "user";
}

function canReadConversation(actor, conversation) {
  return actor.isAdmin === true || String(conversation.user_id) === String(actor.id);
}

function validateContent(content) {
  const value = String(content || "").trim();
  if (!value) {
    throw new AppError("Nội dung tin nhắn không được để trống", 400);
  }
  if (value.length > 2000) {
    throw new AppError("Nội dung tin nhắn tối đa 2000 ký tự", 400);
  }
  return value;
}
```

Use parameterized SQL for all queries:

```js
const conversation = await pool.query(
  `SELECT id, user_id, stadium_id, status
   FROM conversations
   WHERE id = $1`,
  [conversationId],
);
```

When sending:

```js
const role = getSenderRole(actor);
const safeContent = validateContent(content);
```

Update unread count:

```sql
admin_unread_count = CASE WHEN $3 = 'user' THEN admin_unread_count + 1 ELSE admin_unread_count END,
user_unread_count = CASE WHEN $3 = 'admin' THEN user_unread_count + 1 ELSE user_unread_count END
```

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/conversations.service.js test/backend-hardening.test.js
git commit -m "feat: persist user admin conversations"
```

---

### Task 4: Socket.IO Chat Events

**Files:**
- Modify: `index.js`
- Modify: `services/conversations.service.js`
- Test: `test/backend-hardening.test.js`

**Interfaces:**
- Consumes persisted message result from Task 3.
- Produces Socket.IO events:
  - `chat:join-conversation`
  - `chat:leave-conversation`
  - `chat:join-admin`
  - `chat:message-created`
  - `chat:conversation-updated`
  - `chat:message-read`

- [ ] **Step 1: Write the failing test**

Add this test to `test/backend-hardening.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/backend-hardening.test.js`

Expected: FAIL until chat socket events exist.

- [ ] **Step 3: Add socket handlers**

Modify `index.js` inside `io.on("connection", (socket) => { ... })`:

```js
socket.on("chat:join-conversation", (conversationId) => {
  socket.join(`conversation:${conversationId}`);
});

socket.on("chat:leave-conversation", (conversationId) => {
  socket.leave(`conversation:${conversationId}`);
});

socket.on("chat:join-admin", () => {
  socket.join("admin:messages");
});
```

After successful message insert in `services/conversations.service.js`:

```js
if (global.io) {
  global.io.to(`conversation:${conversationId}`).emit("chat:message-created", message);
  global.io.to("admin:messages").emit("chat:conversation-updated", conversation);
}
```

After mark read:

```js
if (global.io) {
  global.io.to(`conversation:${conversationId}`).emit("chat:message-read", {
    conversationId: Number(conversationId),
    readerRole: getSenderRole(actor),
  });
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.js services/conversations.service.js test/backend-hardening.test.js
git commit -m "feat: add realtime user admin chat events"
```

---

### Task 5: Final Backend Verification

**Files:**
- Verify all backend files touched in prior tasks.

**Interfaces:**
- Produces backend branch ready for frontend integration.

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run whitespace check**

Run: `git diff --check`

Expected: no output and exit code `0`.

- [ ] **Step 3: Review changed files**

Run: `git status --short`

Expected: only intended files appear before final commit; clean after commits.

- [ ] **Step 4: Push branch**

```bash
git push
```

Expected: `feature/admin-user-management-api` updates on remote.
