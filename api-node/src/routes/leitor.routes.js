const express = require("express");
const router = express.Router();

const leitorController = require("../controllers/leitor.controller");

router.post("/iniciar", leitorController.iniciar);
router.post("/parar", leitorController.parar);
router.get("/status", leitorController.status);

module.exports = router;