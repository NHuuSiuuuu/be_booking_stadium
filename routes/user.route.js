const express = require("express");
const router = express.Router();
const controller = require(`../controllers/user.controller`);
const { authMiddleWare } = require("../middleware/auth.middleware");

router.get("/", authMiddleWare, controller.get);
router.post("/create", controller.create);

router.post("/create-admin", controller.createAdmin);

router.patch("/update/:id", authMiddleWare, controller.update);

router.delete("/delete/:id", authMiddleWare, controller.delete);

router.post("/password/forgot", authMiddleWare, controller.forgotPassword);

router.post(
  "/password/resetPassword",
  authMiddleWare,
  controller.resetPassword,
);

module.exports = router;
