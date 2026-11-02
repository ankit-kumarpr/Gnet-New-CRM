const express = require("express");
const router = express.Router();
const { getBrand } = require("../controllers/settings.controller");

router.get("/brand", getBrand);

module.exports = router;
