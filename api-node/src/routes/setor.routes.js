const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/setor.controller");

router.get("/",       ctrl.listar);
router.post("/",      ctrl.criar);
router.delete("/:id", ctrl.excluir);

module.exports = router;
