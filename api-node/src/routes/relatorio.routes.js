const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/relatorio.controller");

router.get("/",       ctrl.listar);
router.post("/",      ctrl.gerar);
router.delete("/:id", ctrl.excluir);

module.exports = router;
