const db = require("../config/db");

/* "ativo" e BOOLEAN no PostgreSQL; normaliza 1/0/"true" para true/false. */
const toBool = (v, padrao = true) =>
  v === undefined || v === null ? padrao : v === true || v === 1 || v === "1" || v === "true";

exports.listar = async () => {
  const [rows] = await db.query(`
    SELECT
      o.id, o.nome, o.email, o.empresa_id, o.setor_id,
      o.permissoes, o.ativo, o.criado_em,
      e.nome AS empresa_nome,
      s.nome AS setor_nome
    FROM operadores o
    LEFT JOIN empresas e ON e.id = o.empresa_id
    LEFT JOIN setores  s ON s.id = o.setor_id
    ORDER BY o.id DESC
  `);
  return rows;
};

exports.criar = async (dados) => {
  const { nome, email, senha, empresa_id, setor_id, permissoes } = dados;

  if (!nome || !email) throw new Error("Nome e e-mail são obrigatórios");

  const [existe] = await db.query("SELECT id FROM operadores WHERE email = ?", [email]);
  if (existe.length > 0) throw new Error("E-mail já cadastrado");

  const perms = Array.isArray(permissoes) ? permissoes.join(",") : (permissoes || "leitura");

  const [r] = await db.query(
    `INSERT INTO operadores (nome, email, senha, empresa_id, setor_id, permissoes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [nome, email, senha || "123456", empresa_id || null, setor_id || null, perms]
  );

  return { id: r.insertId, nome, email, empresa_id, setor_id, permissoes: perms };
};

exports.atualizar = async (id, dados) => {
  const { nome, email, empresa_id, setor_id, permissoes, ativo } = dados;
  const perms = Array.isArray(permissoes) ? permissoes.join(",") : permissoes;

  await db.query(
    `UPDATE operadores
        SET nome = ?, email = ?, empresa_id = ?, setor_id = ?,
            permissoes = ?, ativo = ?
      WHERE id = ?`,
    [nome, email, empresa_id || null, setor_id || null,
     perms || "leitura", toBool(ativo), id]
  );

  const [rows] = await db.query("SELECT * FROM operadores WHERE id = ?", [id]);
  return rows[0];
};

exports.excluir = async (id) => {
  await db.query("DELETE FROM operadores WHERE id = ?", [id]);
  return { id };
};
