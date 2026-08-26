require("dotenv").config();

const express = require("express");
const port = process.env.PORT || 3636;
const cors = require("cors");
const app = express();
const cookieParser = require("cookie-parser");
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
  console.log("Một user đã nết nối", socket.id);

  socket.on("join-stadium", (stadiumId) => {
    socket.join(`stadium-${stadiumId}`);
  });

  socket.on("disconnect", () => {
    console.log("User đã bị ngắt kết nối");
  });
});

server.listen(port, () => {
  console.log("Server running in port:", port);
});
