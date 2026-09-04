const express = require("express");
const router = express.Router();
const controller = require("../controllers/conversations.controller");
const { authMiddleWare } = require("../middleware/auth.middleware");
const { adminMiddleWare } = require("../middleware/admin.middleware");

router.post("/socket-token", authMiddleWare, controller.createSocketToken);
router.post("/", authMiddleWare, controller.getOrCreate);
router.get("/", authMiddleWare, controller.list);
router.get("/:id/messages", authMiddleWare, controller.getMessages);
router.post("/:id/messages", authMiddleWare, controller.sendMessage);
router.patch("/:id/read", authMiddleWare, controller.markRead);
router.patch("/:id/close", authMiddleWare, adminMiddleWare, controller.close);

module.exports = router;
