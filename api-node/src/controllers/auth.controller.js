const authService = require("../services/auth.service");

exports.registrar = async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({
        success: false,
        message: "Nome, e-mail e senha são obrigatórios"
      });
    }

    const usuario = await authService.registrar({ nome, email, senha });

    return res.status(201).json({
      success: true,
      message: "Usuário cadastrado com sucesso",
      data: usuario
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.login = async (req, res) => {
    try {
      const { email, senha } = req.body;
  
      // 🔴 VALIDAÇÃO OBRIGATÓRIA
      if (!email || !senha) {
        return res.status(400).json({
          success: false,
          message: "E-mail e senha são obrigatórios"
        });
      }
  
      const resultado = await authService.login({ email, senha });
  
      return res.status(200).json({
        success: true,
        message: "Login realizado com sucesso",
        data: resultado
      });
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }
  };