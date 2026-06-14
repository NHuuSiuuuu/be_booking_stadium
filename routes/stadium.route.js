const express = require("express");
const router = express.Router();
const uploadCloud = require("../middleware/upLoadCloud.middleware");
const StadiumController = require("../controllers/stadiums.controller");

const multer = require("multer");
const upload = multer();
const { authMiddleWare } = require("../middleware/auth.middleware");
const { adminMiddleWare } = require("../middleware/admin.middleware");

const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SECRET,
});

router.get(
  "/stadiums",
  // authMiddleWare,
  // adminMiddleWare,
  StadiumController.index,
);

router.post(
  `/stadium/create`,
  authMiddleWare,
  adminMiddleWare,
  upload.array("thumbnail"),
  uploadCloud.uploadFile,
  StadiumController.create,
);

router.patch(
  `/stadium/update/:id`,
  authMiddleWare,
  adminMiddleWare,
  upload.array("thumbnail"),
  uploadCloud.uploadFile,
  StadiumController.update,
);

router.get(
  `/stadium/detail/:id`,
  authMiddleWare,
  adminMiddleWare,
  StadiumController.detail,
);

router.get(`/stadium/:slug`, StadiumController.detailUser);

router.delete(
  `/stadium/delete/:id`,
  authMiddleWare,
  adminMiddleWare,
  StadiumController.delete,
);

module.exports = router;
