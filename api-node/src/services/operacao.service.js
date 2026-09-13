const db = require("../config/db");

exports.listar = async () => {
  const [rows] = await db.query(`
    SELECT
      o.*,
      e.nome AS empresa_nome
    FROM operacoes o
    LEFT JOIN empresas e ON e.id = o.empresa_id
    ORDER BY o.id DESC
  `);
  return rows;
};

exports.criar = async (dados) => {
  const {
    empresa_id, titulo, descricao, piloto, area_voo, status
  } = dados;

  if (!empresa_id || !titulo) {
    throw new Error("empresa_id e titulo são obrigatórios");
  }

  const [r] = await db.query(
    `INSERT INTO operacoes
        (empresa_id, titulo, descricao, piloto, area_voo, status, iniciada_em)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [empresa_id, titulo, descricao || null,
     piloto || null, area_voo || null, status || "em_andamento"]
  );

  return { id: r.insertId, ...dados };
};

exports.atualizarStatus = async (id, status) => {
  const fim = status === "concluida" || status === "cancelada" ? "NOW()" : "finalizada_em";

  await db.query(
    `UPDATE operacoes SET status = ?, finalizada_em = ${fim} WHERE id = ?`,
    [status, id]
  );

  const [rows] = await db.query("SELECT * FROM operacoes WHERE id = ?", [id]);
  return rows[0];
};

exports.excluir = async (id) => {
  await db.query("DELETE FROM operacoes WHERE id = ?", [id]);
  return { id };
};
