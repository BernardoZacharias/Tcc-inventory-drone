const db = require("../config/db");

exports.listar = async () => {
  const [rows] = await db.query(`
    SELECT s.id, s.nome, s.empresa_id, s.criado_em,
           e.nome AS empresa_nome,
           (SELECT COUNT(*) FROM leituras l WHERE l.setor_id = s.id) AS total_leituras
    FROM setores s
    LEFT JOIN empresas e ON e.id = s.empresa_id
    ORDER BY s.id DESC
  `);
  return rows;
};

exports.criar = async ({ nome, empresa_id }) => {
  if (!nome) throw new Error("Nome do setor é obrigatório");
  const [r] = await db.query(
    "INSERT INTO setores (nome, empresa_id) VALUES (?, ?)",
    [nome, empresa_id || null]
  );
  return { id: r.insertId, nome, empresa_id: empresa_id || null };
};

exports.excluir = async (id) => {
  await db.query("DELETE FROM setores WHERE id = ?", [id]);
  return { id };
};
