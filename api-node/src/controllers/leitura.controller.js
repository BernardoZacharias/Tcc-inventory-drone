const leituraService = require("../services/leitura.service");

exports.criar = async (req, res) => {
  try {
    const leitura = await leituraService.criar(req.body);
    return res.status(201).json({ success: true, data: leitura });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.listar = async (req, res) => {
  try {
    const leituras = await leituraService.listar();
    return res.status(200).json({ success: true, data: leituras });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.porEmpresa = async (req, res) => {
  try {
    const { id } = req.params;
    const leituras = await leituraService.listarPorEmpresa(id);
    return res.status(200).json({ success: true, data: leituras });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
