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

async function getConversationById(conversationId) {
  const result = await pool.query(
    `
    SELECT id, user_id, stadium_id, status
    FROM conversations
    WHERE id = $1
    `,
    [conversationId],
  );

  return result.rows[0] || null;
}

async function getConversationDetail(conversationId) {
  const result = await pool.query(
    `
    SELECT
      c.id,
      c.user_id,
      c.stadium_id,
      c.status,
      c.last_message,
      c.last_message_at,
      c.user_unread_count,
      c.admin_unread_count,
      c.created_at,
      c.updated_at,
      u.fullname AS user_fullname,
      u.email AS user_email,
      u.phone AS user_phone,
      s.name AS stadium_name,
      s.slug AS stadium_slug
    FROM conversations c
    LEFT JOIN users u ON u.id = c.user_id
    LEFT JOIN stadiums s ON s.id = c.stadium_id
    WHERE c.id = $1
    `,
    [conversationId],
  );

  return result.rows[0] || null;
}

function ensureCanRead(actor, conversation) {
  if (!conversation) {
    throw new AppError("Cuộc trò chuyện không tồn tại", 404);
  }

  if (!canReadConversation(actor, conversation)) {
    throw new AppError("Không có quyền", 403);
  }
}

function emitConversationUpdated(conversation) {
  if (!global.io || !conversation) return;

  global.io
    .to(`conversation:${conversation.id}`)
    .emit("chat:conversation-updated", conversation);
  global.io.to("admin:messages").emit("chat:conversation-updated", conversation);
}

function emitMessageCreated(conversationId, message, conversation) {
  if (!global.io) return;

  global.io.to(`conversation:${conversationId}`).emit("chat:message-created", message);
  global.io.to("admin:messages").emit("chat:message-created", message);
  global.io.to("admin:messages").emit("chat:conversation-updated", conversation);
}

module.exports.getOrCreate = async ({ userId, stadiumId }) => {
  if (!userId) {
    throw new AppError("Hết phiên đăng nhập", 401);
  }

  if (stadiumId) {
    const stadium = await pool.query(
      `
      SELECT id
      FROM stadiums
      WHERE id = $1
      `,
      [stadiumId],
    );

    if (stadium.rows.length === 0) {
      throw new AppError("Sân không tồn tại", 404);
    }
  }

  const existing = await pool.query(
    `
    SELECT
      c.id,
      c.user_id,
      c.stadium_id,
      c.status,
      c.last_message,
      c.last_message_at,
      c.user_unread_count,
      c.admin_unread_count,
      c.created_at,
      c.updated_at,
      s.name AS stadium_name,
      s.slug AS stadium_slug
    FROM conversations c
    LEFT JOIN stadiums s ON s.id = c.stadium_id
    WHERE c.user_id = $1
    ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
    LIMIT 1
    `,
    [userId],
  );

  if (existing.rows[0]) {
    if (!stadiumId || String(existing.rows[0].stadium_id) === String(stadiumId)) {
      return existing.rows[0];
    }

    const updated = await pool.query(
      `
      UPDATE conversations
      SET stadium_id = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        user_id,
        stadium_id,
        status,
        last_message,
        last_message_at,
        user_unread_count,
        admin_unread_count,
        created_at,
        updated_at
      `,
      [stadiumId, existing.rows[0].id],
    );

    return getConversationDetail(updated.rows[0].id);
  }

  const created = await pool.query(
    `
    INSERT INTO conversations (user_id, stadium_id)
    VALUES ($1, $2)
    RETURNING
      id,
      user_id,
      stadium_id,
      status,
      last_message,
      last_message_at,
      user_unread_count,
      admin_unread_count,
      created_at,
      updated_at
    `,
    [userId, stadiumId],
  );

  return created.rows[0];
};

module.exports.list = async (actor) => {
  const values = [];
  let whereSql = "";

  if (actor.isAdmin !== true) {
    values.push(actor.id);
    whereSql = "WHERE c.user_id = $1";
  }

  const result = await pool.query(
    `
    SELECT
      c.id,
      c.user_id,
      c.stadium_id,
      c.status,
      c.last_message,
      c.last_message_at,
      c.user_unread_count,
      c.admin_unread_count,
      c.created_at,
      c.updated_at,
      u.fullname AS user_fullname,
      u.email AS user_email,
      u.phone AS user_phone,
      s.name AS stadium_name,
      s.slug AS stadium_slug
    FROM conversations c
    LEFT JOIN users u ON u.id = c.user_id
    LEFT JOIN stadiums s ON s.id = c.stadium_id
    ${whereSql}
    ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
    `,
    values,
  );

  return result.rows;
};

module.exports.getMessages = async (conversationId, actor) => {
  const conversation = await getConversationById(conversationId);
  ensureCanRead(actor, conversation);

  const result = await pool.query(
    `
    SELECT
      id,
      conversation_id,
      sender_id,
      sender_role,
      content,
      read_at,
      created_at
    FROM messages
    WHERE conversation_id = $1
    ORDER BY created_at ASC
    `,
    [conversationId],
  );

  return result.rows;
};

module.exports.sendMessage = async (conversationId, actor, content) => {
  const conversation = await getConversationById(conversationId);
  ensureCanRead(actor, conversation);

  if (conversation.status !== "open") {
    throw new AppError("Cuộc trò chuyện đã đóng", 409);
  }

  const senderRole = getSenderRole(actor);
  const safeContent = validateContent(content);

  const messageResult = await pool.query(
    `
    INSERT INTO messages (conversation_id, sender_id, sender_role, content)
    VALUES ($1, $2, $3, $4)
    RETURNING
      id,
      conversation_id,
      sender_id,
      sender_role,
      content,
      read_at,
      created_at
    `,
    [conversationId, actor.id, senderRole, safeContent],
  );

  await pool.query(
    `
    UPDATE conversations
    SET
      last_message = $1,
      last_message_at = NOW(),
      updated_at = NOW(),
      admin_unread_count = CASE WHEN $2 = 'user' THEN admin_unread_count + 1 ELSE admin_unread_count END,
      user_unread_count = CASE WHEN $2 = 'admin' THEN user_unread_count + 1 ELSE user_unread_count END
    WHERE id = $3
    `,
    [safeContent, senderRole, conversationId],
  );

  const message = messageResult.rows[0];
  const updatedConversation = await getConversationDetail(conversationId);
  emitMessageCreated(conversationId, message, updatedConversation);

  return message;
};

module.exports.markRead = async (conversationId, actor) => {
  const conversation = await getConversationById(conversationId);
  ensureCanRead(actor, conversation);

  const readerRole = getSenderRole(actor);
  const unreadColumn =
    readerRole === "admin" ? "admin_unread_count" : "user_unread_count";
  const oppositeRole = readerRole === "admin" ? "user" : "admin";

  await pool.query(
    `
    UPDATE messages
    SET read_at = COALESCE(read_at, NOW())
    WHERE conversation_id = $1 AND sender_role = $2
    `,
    [conversationId, oppositeRole],
  );

  await pool.query(
    `
    UPDATE conversations
    SET ${unreadColumn} = 0, updated_at = NOW()
    WHERE id = $1
    `,
    [conversationId],
  );

  if (global.io) {
    global.io.to(`conversation:${conversationId}`).emit("chat:message-read", {
      conversationId: Number(conversationId),
      readerRole,
    });
  }

  const updatedConversation = await getConversationDetail(conversationId);
  emitConversationUpdated(updatedConversation);

  return updatedConversation;
};

module.exports.close = async (conversationId) => {
  const result = await pool.query(
    `
    UPDATE conversations
    SET status = 'closed', updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      user_id,
      stadium_id,
      status,
      last_message,
      last_message_at,
      user_unread_count,
      admin_unread_count,
      created_at,
      updated_at
    `,
    [conversationId],
  );

  if (result.rows.length === 0) {
    throw new AppError("Cuộc trò chuyện không tồn tại", 404);
  }

  const updatedConversation = await getConversationDetail(conversationId);
  emitConversationUpdated(updatedConversation);

  return updatedConversation;
};

module.exports.delete = async (conversationId) => {
  const result = await pool.query(
    `
    DELETE FROM conversations
    WHERE id = $1
    RETURNING id
    `,
    [conversationId],
  );

  if (result.rows.length === 0) {
    throw new AppError("Cuộc trò chuyện không tồn tại", 404);
  }

  if (global.io) {
    global.io.to("admin:messages").emit("chat:conversation-deleted", {
      conversationId: Number(conversationId),
    });
  }

  return { id: Number(conversationId) };
};
