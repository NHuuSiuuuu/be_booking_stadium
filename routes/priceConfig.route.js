const express = require("express");
const router = express.Router();

const controller = require("../controllers/priceConfig.controller");
const { authMiddleWare } = require("../middleware/auth.middleware");

router.post("/create", authMiddleWare, controller.create);

router.patch("/update", authMiddleWare, controller.update);

router.delete("/delete/:id", authMiddleWare, controller.delete);

router.get("/:id", authMiddleWare, controller.getByStadium);

module.exports = router;
