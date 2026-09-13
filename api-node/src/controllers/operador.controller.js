const service = require("../services/operador.service");

const ok   = (res, data, code = 200) => res.status(code).json({ success: true, data });
const fail = (res, err, code = 400)  => res.status(code).json({ success: false, message: err.message });

exports.listar    = async (req, res) => { try { ok(res, await service.listar()); }                catch (e) { fail(res, e, 500); } };
exports.criar     = async (req, res) => { try { ok(res, await service.criar(req.body), 201); }    catch (e) { fail(res, e); } };
exports.atualizar = async (req, res) => { try { ok(res, await service.atualizar(req.params.id, req.body)); } catch (e) { fail(res, e); } };
exports.excluir   = async (req, res) => { try { ok(res, await service.excluir(req.params.id)); }  catch (e) { fail(res, e, 500); } };
