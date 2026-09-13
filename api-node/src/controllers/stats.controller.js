const service = require("../services/stats.service");

exports.resumo = async (req, res) => {
  try {
    res.status(200).json({ success: true, data: await service.resumo() });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};
