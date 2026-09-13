const db = require("../config/db");

exports.listar = async () => {
  const [rows] = await db.query(`
    SELECT r.*, e.nome AS empresa_nome
      FROM relatorios r
      LEFT JOIN empresas e ON e.id = r.empresa_id
      ORDER BY r.id DESC
  `);
  return rows;
};

exports.gerarParaEmpresa = async (empresa_id, { tipo, periodo_ini, periodo_fim, gerado_por, titulo }) => {
  if (!empresa_id) throw new Error("empresa_id é obrigatório");

  const [[stats]] = await db.query(
    `SELECT
        COUNT(*) AS total_lidos,
        SUM(CASE WHEN status <> 'lido' THEN 1 ELSE 0 END) AS total_erros
       FROM leituras
      WHERE empresa_id = ?
        AND (?::date IS NULL OR criado_em >= ?::date)
        AND (?::date IS NULL OR criado_em < (?::date + INTERVAL '1 day'))`,
    [empresa_id, periodo_ini || null, periodo_ini || null,
     periodo_fim || null, periodo_fim || null]
  );

  const [r] = await db.query(
    `INSERT INTO relatorios
        (empresa_id, titulo, tipo, periodo_ini, periodo_fim,
         total_lidos, total_erros, gerado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      empresa_id,
      titulo || `Relatório ${tipo || "customizado"}`,
      tipo || "customizado",
      periodo_ini || null,
      periodo_fim || null,
      stats.total_lidos || 0,
      stats.total_erros || 0,
      gerado_por || "sistema"
    ]
  );

  const [novo] = await db.query("SELECT * FROM relatorios WHERE id = ?", [r.insertId]);
  return novo[0];
};

exports.excluir = async (id) => {
  await db.query("DELETE FROM relatorios WHERE id = ?", [id]);
  return { id };
};
