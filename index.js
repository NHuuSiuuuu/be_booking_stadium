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
const io = new Server(server, {
  cors: {
    origin: process.env.REACT_APP_URL || "*",
  },
});

global.io = io;

// Ban đầu cors * : cho phép tất cả trình duyệt đc vào - khi gửi cookiue vào trình duyệt - trình d nghĩ nguy hiểm -> chặn
app.use(
  cors({
    origin: process.env.REACT_APP_URL || "*", // chỉ fe này mới đc vào + được gửi
    credentials: true, // cho phép fe gửi và nhận cookie
  }),
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
