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
