const express = require("express");
const router = express.Router();

const controller = require("../controllers/priceConfig.controller");
const { authMiddleWare } = require("../middleware/auth.middleware");
const { adminMiddleWare } = require("../middleware/admin.middleware");

router.post("/create",  controller.create);

router.patch("/update", authMiddleWare, adminMiddleWare, controller.update);

router.delete(
  "/delete/:id",
  authMiddleWare,
  adminMiddleWare,
  controller.delete,
);

router.get("/:id", controller.getByStadium);

module.exports = router;
