const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/drone.controller");

router.get("/",       ctrl.listar);
router.post("/",      ctrl.criar);
router.put("/:id",    ctrl.atualizar);
router.delete("/:id", ctrl.excluir);

module.exports = router;
