const express = require("express");
const route = express.Router();

const ChatController = require("../controllers/chat.controller");
const { authMiddleWare } = require("../middleware/auth.middleware");
const { adminMiddleWare } = require("../middleware/admin.middleware");

route.get(`/index`, authMiddleWare, adminMiddleWare, ChatController.index);

route.post(`/`, ChatController.chat);

route.post(`/update-docs-stadium/:stadiumId`, authMiddleWare, adminMiddleWare, ChatController.updateDocument);

module.exports = route;
