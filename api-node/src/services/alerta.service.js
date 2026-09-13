const db = require("../config/db");

exports.listar = async () => {
  const [rows] = await db.query(`
    SELECT a.*, e.nome AS empresa_nome
      FROM alertas a
      LEFT JOIN empresas e ON e.id = a.empresa_id
      ORDER BY a.id DESC
      LIMIT 100
  `);
  return rows;
};

exports.criar = async ({ empresa_id, tipo, mensagem }) => {
  if (!mensagem) throw new Error("mensagem é obrigatória");

  const [r] = await db.query(
    `INSERT INTO alertas (empresa_id, tipo, mensagem)
     VALUES (?, ?, ?)`,
    [empresa_id || null, tipo || "info", mensagem]
  );

  return { id: r.insertId, empresa_id, tipo, mensagem };
};

exports.marcarLido = async (id) => {
  await db.query("UPDATE alertas SET lido = TRUE WHERE id = ?", [id]);
  return { id, lido: true };
};

exports.excluir = async (id) => {
  await db.query("DELETE FROM alertas WHERE id = ?", [id]);
  return { id };
};
