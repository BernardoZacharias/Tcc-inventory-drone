const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/empresa.controller");

router.get("/",        ctrl.listar);
router.get("/:id",     ctrl.obter);
router.post("/",       ctrl.criar);
router.put("/:id",     ctrl.atualizar);
router.delete("/:id",  ctrl.excluir);

module.exports = router;
