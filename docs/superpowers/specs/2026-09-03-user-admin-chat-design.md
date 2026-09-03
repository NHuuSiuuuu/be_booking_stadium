# User Admin Chat Design

## Goal

Build a real user-to-admin chat feature for the booking stadium app.
This feature is separate from the existing AI chatbot in `routes/chat.route.js` and `controllers/chat.controller.js`.

The admin role represents the stadium owner group. All admins can manage all stadium conversations.

## Decisions

- Admins are a shared group, not per-stadium owners.
- Conversations are tied to one user and optionally one stadium.
- Messages are stored in PostgreSQL.
- REST APIs are the source of truth for validation and persistence.
- Socket.IO is used after persistence to notify connected clients in realtime.
- Existing AI chatbot endpoints must not be reused for human chat.

## Database Design

### `conversations`

Recommended columns:

- `id SERIAL PRIMARY KEY`
- `user_id INTEGER NOT NULL REFERENCES users(id)`
- `stadium_id INTEGER REFERENCES stadiums(id)`
- `status VARCHAR(20) NOT NULL DEFAULT 'open'`
- `last_message TEXT`
- `last_message_at TIMESTAMP`
- `user_unread_count INTEGER NOT NULL DEFAULT 0`
- `admin_unread_count INTEGER NOT NULL DEFAULT 0`
- `created_at TIMESTAMP NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMP NOT NULL DEFAULT NOW()`

Recommended constraints:

- `status` should allow `open` and `closed`.
- Unique active conversation per `user_id` and `stadium_id` is recommended for MVP.

### `messages`

Recommended columns:

- `id SERIAL PRIMARY KEY`
- `conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE`
- `sender_id INTEGER NOT NULL REFERENCES users(id)`
- `sender_role VARCHAR(20) NOT NULL`
- `content TEXT NOT NULL`
- `read_at TIMESTAMP`
- `created_at TIMESTAMP NOT NULL DEFAULT NOW()`

Recommended constraints:

- `sender_role` should allow `user` and `admin`.
- `content` should be trimmed and must not be empty.

## Backend Modules

Add new files instead of mixing human chat into the AI chatbot module:

- `routes/conversation.route.js`
- `controllers/conversations.controller.js`
- `services/conversations.service.js`

Register the route in `routes/index.route.js`:

- `/api/conversations`

## API Design

### `POST /api/conversations`

Auth:
- Requires logged-in user.

Body:

```json
{
  "stadium_id": 1
}
```

Behavior:
- If a conversation already exists for the current user and stadium, return it.
- Otherwise create a new `open` conversation.
- Admins may also create/open conversations if needed, but MVP should focus on user creation from stadium detail.

### `GET /api/conversations`

Auth:
- Requires logged-in user.

Behavior:
- User role: return only conversations where `user_id = req.user.id`.
- Admin role: return all conversations.

Response should include:
- Conversation id.
- User name/email/phone.
- Stadium name/slug.
- Last message.
- Last message time.
- Unread count for the current role.
- Status.

### `GET /api/conversations/:id/messages`

Auth:
- Requires logged-in user.

Authorization:
- User can read only their own conversation.
- Admin can read any conversation.

Behavior:
- Return messages ordered by `created_at ASC`.

### `POST /api/conversations/:id/messages`

Auth:
- Requires logged-in user.

Authorization:
- User can send only to their own open conversation.
- Admin can send to any open conversation.

Body:

```json
{
  "content": "Sân còn trống tối nay không?"
}
```

Behavior:
- Trim and validate content.
- Insert message.
- Update conversation `last_message`, `last_message_at`, `updated_at`, and unread count.
- Emit Socket.IO events after successful commit/insert.

### `PATCH /api/conversations/:id/read`

Auth:
- Requires logged-in user.

Behavior:
- Mark messages from the opposite role as read.
- Reset unread count for the current role.
- Emit `chat:message-read`.

### `PATCH /api/conversations/:id/close`

Auth:
- Requires admin.

Behavior:
- Set conversation `status = 'closed'`.
- Emit `chat:conversation-updated`.

## Socket.IO Design

Existing booking events use `join-stadium` and stadium rooms.
Chat should use separate event names and rooms.

Rooms:

- `conversation:{conversationId}`
- `admin:messages`

Client emits:

- `chat:join-conversation`
- `chat:leave-conversation`
- `chat:join-admin`

Server emits:

- `chat:message-created`
- `chat:conversation-updated`
- `chat:message-read`

Recommended MVP flow:

1. Client sends message through REST.
2. Service validates and inserts message.
3. Controller/service emits through `global.io`.
4. User room receives `chat:message-created`.
5. Admin room receives `chat:conversation-updated` and `chat:message-created`.

## Security Rules

- All human chat endpoints require `authMiddleWare`.
- Admin-only actions require `adminMiddleWare`.
- Never allow a user to fetch another user's conversation.
- Never trust `sender_role` from the request body; derive it from `req.user.isAdmin`.
- Validate `stadium_id` exists when creating a conversation.
- Validate message content length before insert.
- Use parameterized SQL only.

## Error Handling

- Missing auth: `401`.
- Forbidden conversation access: `403`.
- Missing conversation or stadium: `404`.
- Empty message: `400`.
- Closed conversation send attempt: `400` or `409`.

## Out Of Scope For MVP

- File/image attachments.
- Typing indicators.
- Per-admin assignment.
- Per-stadium owner mapping.
- Push notifications or emails.
- Message deletion.
- Search across conversations.

## Tests

Add backend regression tests for:

- Human chat routes require auth.
- User can only list/read their own conversations.
- Admin can list/read all conversations.
- Message sender role is derived from authenticated user.
- Message content is parameterized and validated.
- AI chatbot route remains separate from human chat routes.
- Socket event names use `chat:*` and do not reuse booking slot events.
