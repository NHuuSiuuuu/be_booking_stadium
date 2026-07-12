const express = require("express");
const route = express.Router();

const ChatController = require("../controllers/chat.controller");

route.get(`/index`, ChatController.index);

route.post(`/`, ChatController.chat);

route.post(`/update-docs-stadium/:stadiumId`, ChatController.updateDocument);

module.exports = route;
