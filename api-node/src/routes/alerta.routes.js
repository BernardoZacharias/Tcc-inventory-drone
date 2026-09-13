const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/alerta.controller");

router.get("/",          ctrl.listar);
router.post("/",         ctrl.criar);
router.patch("/:id/lido", ctrl.marcarLido);
router.delete("/:id",    ctrl.excluir);

module.exports = router;
