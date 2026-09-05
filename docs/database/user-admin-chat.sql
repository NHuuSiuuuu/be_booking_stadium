CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  stadium_id INTEGER REFERENCES stadiums(id),
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  last_message TEXT,
  last_message_at TIMESTAMP,
  user_unread_count INTEGER NOT NULL DEFAULT 0,
  admin_unread_count INTEGER NOT NULL DEFAULT 0,
  admin_hidden_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT conversations_status_check CHECK (status IN ('open', 'closed')),
  CONSTRAINT conversations_user_unique UNIQUE (user_id)
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

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS admin_hidden_at TIMESTAMP;

-- Migration for existing deployments that previously allowed one conversation per user/stadium.
-- Keeps the newest conversation per user, moves older messages into it, then replaces the unique constraint.
WITH ranked_conversations AS (
  SELECT
    id,
    user_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY COALESCE(last_message_at, updated_at, created_at) DESC, id DESC
    ) AS rank,
    FIRST_VALUE(id) OVER (
      PARTITION BY user_id
      ORDER BY COALESCE(last_message_at, updated_at, created_at) DESC, id DESC
    ) AS keep_id
  FROM conversations
)
UPDATE messages m
SET conversation_id = r.keep_id
FROM ranked_conversations r
WHERE m.conversation_id = r.id
  AND r.rank > 1;

WITH ranked_conversations AS (
  SELECT
    id,
    user_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY COALESCE(last_message_at, updated_at, created_at) DESC, id DESC
    ) AS rank,
    FIRST_VALUE(id) OVER (
      PARTITION BY user_id
      ORDER BY COALESCE(last_message_at, updated_at, created_at) DESC, id DESC
    ) AS keep_id
  FROM conversations
),
conversation_rollups AS (
  SELECT
    user_id,
    MAX(last_message_at) AS last_message_at,
    SUM(user_unread_count) AS user_unread_count,
    SUM(admin_unread_count) AS admin_unread_count
  FROM conversations
  GROUP BY user_id
)
UPDATE conversations c
SET
  last_message_at = cr.last_message_at,
  user_unread_count = cr.user_unread_count,
  admin_unread_count = cr.admin_unread_count,
  updated_at = NOW()
FROM conversation_rollups cr
WHERE c.user_id = cr.user_id
  AND c.id IN (
    SELECT keep_id
    FROM ranked_conversations
    WHERE rank = 1
  );

WITH ranked_conversations AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY COALESCE(last_message_at, updated_at, created_at) DESC, id DESC
    ) AS rank
  FROM conversations
)
DELETE FROM conversations c
USING ranked_conversations r
WHERE c.id = r.id
  AND r.rank > 1;

ALTER TABLE conversations
DROP CONSTRAINT IF EXISTS conversations_user_stadium_unique;

ALTER TABLE conversations
DROP CONSTRAINT IF EXISTS conversations_user_unique;

ALTER TABLE conversations
ADD CONSTRAINT conversations_user_unique UNIQUE (user_id);
