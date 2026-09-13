const service = require("../services/relatorio.service");

const ok   = (res, data, code = 200) => res.status(code).json({ success: true, data });
const fail = (res, err, code = 400)  => res.status(code).json({ success: false, message: err.message });

exports.listar = async (req, res) => {
  try { ok(res, await service.listar()); } catch (e) { fail(res, e, 500); }
};

exports.gerar = async (req, res) => {
  try {
    const { empresa_id, ...rest } = req.body;
    ok(res, await service.gerarParaEmpresa(empresa_id, rest), 201);
  } catch (e) { fail(res, e); }
};

exports.excluir = async (req, res) => {
  try { ok(res, await service.excluir(req.params.id)); } catch (e) { fail(res, e, 500); }
};
