const express = require("express");
const router = express.Router();

const leituraController = require("../controllers/leitura.controller");
const authMiddleware = require("../middlewares/auth.middleware");

router.post("/", leituraController.criar);
router.get("/", authMiddleware, leituraController.listar);
router.get("/empresa/:id", authMiddleware, leituraController.porEmpresa);
module.exports = router;