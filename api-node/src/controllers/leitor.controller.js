const leitorService = require("../services/leitor.service");

exports.iniciar = (req, res) => {
  try {
    console.log("BODY /api/leitura/iniciar:", req.body);

    const { empresa_id } = req.body;

    if (!empresa_id) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "empresa_id não informado"
      });
    }

    const resultado = leitorService.iniciarLeitura(empresa_id);

    return res.status(resultado.sucesso ? 200 : 400).json(resultado);
  } catch (error) {
    console.error("Erro ao iniciar leitura:", error);

    return res.status(500).json({
      sucesso: false,
      mensagem: error.message
    });
  }
};

exports.parar = (req, res) => {
  try {
    const resultado = leitorService.pararLeitura();

    return res.status(resultado.sucesso ? 200 : 400).json(resultado);
  } catch (error) {
    return res.status(500).json({
      sucesso: false,
      mensagem: error.message
    });
  }
};

exports.status = (req, res) => {
  return res.status(200).json(leitorService.statusLeitura());
};