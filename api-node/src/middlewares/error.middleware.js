module.exports = (err, req, res, next) => {
    console.error(err);
  
    return res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  };