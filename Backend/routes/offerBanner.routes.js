const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth.middleware");
const { listActiveOfferBanners } = require("../controllers/offerBanner.controller");

router.get("/active", authenticate, listActiveOfferBanners);

module.exports = router;
