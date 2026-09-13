const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/operacao.controller");

router.get("/",            ctrl.listar);
router.post("/",           ctrl.criar);
router.patch("/:id/status", ctrl.atualizarStatus);
router.delete("/:id",      ctrl.excluir);

module.exports = router;
