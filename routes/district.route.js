const express = require("express");
const router = express.Router();


const DistrictController = require("../controllers/districts.controller");
router.get(`/districts`, DistrictController.index);

module.exports = router;