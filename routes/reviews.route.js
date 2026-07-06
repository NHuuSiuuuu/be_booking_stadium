const express = require("express");
const router = express.Router();

const controller = require("../controllers/reviews.controller");
const { authMiddleWare } = require("../middleware/auth.middleware");
const { adminMiddleWare } = require("../middleware/admin.middleware");

router.post("/", authMiddleWare, controller.create);

router.patch("/:id", authMiddleWare, controller.update);

router.delete("/:id", authMiddleWare, controller.delete);

// Lấy reviews theo sân
router.get("/stadium/:stadiumId", controller.getReviewsByStadium);

// Lấy thống kê trung bình review
router.get("/stadium/:stadiumId/statistics", controller.statistics);

// Lấy review của user hiện tại
router.get("/my-review/:stadiumId", authMiddleWare, controller.getMyReview);

module.exports = router;
