require("dotenv").config();

const express = require("express");
const port = process.env.PORT || 3636;
const cors = require("cors");
const app = express();
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const routes = require("./routes/index.route");
const { pool } = require("./pool");

const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const defaultAllowedOrigins = [
  "https://booking-stadium.vercel.app",
  "https://fe-booking-stadium.vercel.app",
];

function normalizeOrigin(origin) {
  return origin ? origin.replace(/\/+$/, "") : origin;
}

const configuredOrigins = [
  ...defaultAllowedOrigins,
  process.env.REACT_APP_URL,
  process.env.FRONTEND_URL,
]
  .flatMap((value) => (value ? value.split(",") : []))
  .map((value) => normalizeOrigin(value.trim()))
  .filter(Boolean);

function isVercelPreviewOrigin(origin) {
  return /^https:\/\/fe-booking-stadium-[a-z0-9-]+.*\.vercel\.app$/.test(origin);
}

function isAllowedCorsOrigin(origin) {
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);

  return (
    configuredOrigins.includes(normalizedOrigin) ||
    isVercelPreviewOrigin(normalizedOrigin)
  );
}

function corsOrigin(origin, callback) {
  if (isAllowedCorsOrigin(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error("Not allowed by CORS"));
}

const corsOptions = {
  origin: corsOrigin,
  credentials: true,
};

const io = new Server(server, {
  cors: corsOptions,
});

global.io = io;

function parseSocketCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((cookies, item) => {
    const [rawKey, ...rawValue] = item.trim().split("=");
    if (!rawKey) return cookies;

    cookies[rawKey] = decodeURIComponent(rawValue.join("="));
    return cookies;
  }, {});
}

function getSocketUser(socket) {
  const authToken = socket.handshake.auth?.token;

  if (authToken) {
    try {
      return jwt.verify(authToken, process.env.ACCESS_TOKEN);
    } catch (err) {
      return null;
    }
  }

  const cookies = parseSocketCookies(socket.handshake.headers.cookie || "");
  const token = cookies.access_token || cookies.refresh_token;

  if (!token) return null;

  try {
    return jwt.verify(
      token,
      cookies.access_token ? process.env.ACCESS_TOKEN : process.env.REFRESH_TOKEN,
    );
  } catch (err) {
    return null;
  }
}

function getSocketSenderRole(socket) {
  return socket.data.user?.isAdmin === true ? "admin" : "user";
}

async function canSocketJoinConversation(socket, conversationId) {
  const user = socket.data.user;

  if (!user) return false;
  if (user.isAdmin === true) return true;

  const result = await pool.query(
    `
    SELECT user_id
    FROM conversations
    WHERE id = $1
    `,
    [conversationId],
  );

  return String(result.rows[0]?.user_id) === String(user.id);
}

// Ban đầu cors * : cho phép tất cả trình duyệt đc vào - khi gửi cookiue vào trình duyệt - trình d nghĩ nguy hiểm -> chặn
app.use(
  cors(corsOptions),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

routes(app);

pool.connect((err, client, release) => {
  if (err) {
    return console.error("Error acquiring client", err.stack);
  }
  console.log("Connected to PostgreSQL");
  release();
});

// Lỗi trả về chuỗi json
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    message: err.message || "Lỗi server",
  });
});

io.on("connection", (socket) => {
  socket.data.user = getSocketUser(socket);
  console.log("Một user đã nết nối", socket.id);

  socket.on("join-stadium", (stadiumId) => {
    socket.join(`stadium-${stadiumId}`);
  });

  socket.on("chat:join-conversation", async (conversationId) => {
    if (!(await canSocketJoinConversation(socket, conversationId))) {
      socket.emit("chat:error", { message: "Không có quyền" });
      return;
    }

    socket.join(`conversation:${conversationId}`);
  });

  socket.on("chat:typing", async (conversationId) => {
    if (!(await canSocketJoinConversation(socket, conversationId))) {
      socket.emit("chat:error", { message: "Không có quyền" });
      return;
    }

    const payload = {
      conversationId: Number(conversationId),
      senderRole: getSocketSenderRole(socket),
    };

    socket.to(`conversation:${conversationId}`).emit("chat:typing", payload);

    if (payload.senderRole === "user") {
      global.io.to("admin:messages").emit("chat:typing", payload);
    }
  });

  socket.on("chat:stop-typing", async (conversationId) => {
    if (!(await canSocketJoinConversation(socket, conversationId))) {
      return;
    }

    const payload = {
      conversationId: Number(conversationId),
      senderRole: getSocketSenderRole(socket),
    };

    socket.to(`conversation:${conversationId}`).emit("chat:stop-typing", payload);

    if (payload.senderRole === "user") {
      global.io.to("admin:messages").emit("chat:stop-typing", payload);
    }
  });

  socket.on("chat:leave-conversation", (conversationId) => {
    socket.leave(`conversation:${conversationId}`);
  });

  socket.on("chat:join-admin", () => {
    if (socket.data.user?.isAdmin !== true) {
      socket.emit("chat:error", { message: "Không có quyền" });
      return;
    }

    socket.join("admin:messages");
  });

  socket.on("disconnect", () => {
    console.log("User đã bị ngắt kết nối");
  });
});

server.listen(port, () => {
  console.log("Server running in port:", port);
});
