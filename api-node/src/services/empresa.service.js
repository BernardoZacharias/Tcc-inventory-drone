const db = require("../config/db");

/* "ativo" e BOOLEAN no PostgreSQL; normaliza 1/0/"true" para true/false. */
const toBool = (v, padrao = true) =>
  v === undefined || v === null ? padrao : v === true || v === 1 || v === "1" || v === "true";

exports.listar = async () => {
  const [rows] = await db.query(`
    SELECT
      e.id, e.nome, e.cnpj, e.segmento, e.responsavel,
      e.email, e.telefone, e.observacao, e.ativo, e.criado_em,
      (SELECT COUNT(*) FROM leituras l WHERE l.empresa_id = e.id) AS total_leituras
    FROM empresas e
    ORDER BY e.id DESC
  `);
  return rows;
};

exports.obter = async (id) => {
  const [rows] = await db.query("SELECT * FROM empresas WHERE id = ?", [id]);
  return rows[0] || null;
};

exports.criar = async (dados) => {
  const { nome, cnpj, segmento, responsavel, email, telefone, observacao } = dados;

  if (!nome) throw new Error("Nome da empresa é obrigatório");

  const [r] = await db.query(
    `INSERT INTO empresas (nome, cnpj, segmento, responsavel, email, telefone, observacao)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [nome, cnpj || null, segmento || null, responsavel || null,
     email || null, telefone || null, observacao || null]
  );

  return { id: r.insertId, ...dados };
};

exports.atualizar = async (id, dados) => {
  const { nome, cnpj, segmento, responsavel, email, telefone, observacao, ativo } = dados;

  await db.query(
    `UPDATE empresas
        SET nome = ?, cnpj = ?, segmento = ?, responsavel = ?,
            email = ?, telefone = ?, observacao = ?, ativo = ?
      WHERE id = ?`,
    [nome, cnpj, segmento, responsavel, email, telefone, observacao,
     toBool(ativo), id]
  );

  return exports.obter(id);
};

exports.excluir = async (id) => {
  await db.query("DELETE FROM empresas WHERE id = ?", [id]);
  return { id };
};
