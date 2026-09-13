const db = require("../config/db");

/*
 * Metricas do dashboard.
 *
 * Consultas escritas em PostgreSQL:
 *   MySQL                              PostgreSQL
 *   ------------------------------     ------------------------------
 *   CURDATE()                          CURRENT_DATE
 *   DATE(coluna)                       coluna::date
 *   DATE_SUB(CURDATE(), INTERVAL 6 DAY)  CURRENT_DATE - INTERVAL '6 days'
 *   lido = 0 / ativo = 1               lido = FALSE / ativo = TRUE
 */

exports.resumo = async () => {
  const [[empresas]]   = await db.query("SELECT COUNT(*) AS total FROM empresas");
  const [[leituras]]   = await db.query("SELECT COUNT(*) AS total FROM leituras");
  const [[operacoes]]  = await db.query("SELECT COUNT(*) AS total FROM operacoes");
  const [[relatorios]] = await db.query("SELECT COUNT(*) AS total FROM relatorios");
  const [[alertas]]    = await db.query("SELECT COUNT(*) AS total FROM alertas WHERE lido = FALSE");
  const [[drones]]     = await db.query("SELECT COUNT(*) AS total FROM drones WHERE status = 'disponivel'");
  const [[operadores]] = await db.query("SELECT COUNT(*) AS total FROM operadores WHERE ativo = TRUE");

  // -- Metricas estruturadas das leituras --
  const [[agg]] = await db.query(`
    SELECT
      COALESCE(SUM(quantidade), 0)                    AS quantidade_total,
      COUNT(*) FILTER (WHERE fragil = 'Sim')          AS itens_frageis,
      COUNT(DISTINCT produto_id)                      AS produtos_distintos,
      COUNT(DISTINCT local_lido)                      AS locais_distintos
    FROM leituras
  `);

  const [[hoje]] = await db.query(`
    SELECT COUNT(*) AS total FROM leituras
     WHERE data_hora_leitura::date = CURRENT_DATE
  `);

  const [serie] = await db.query(`
    SELECT data_hora_leitura::date AS dia, COUNT(*) AS total
      FROM leituras
     WHERE data_hora_leitura >= CURRENT_DATE - INTERVAL '6 days'
     GROUP BY data_hora_leitura::date
     ORDER BY dia ASC
  `);

  const [topEmpresas] = await db.query(`
    SELECT e.id, e.nome, COUNT(l.id) AS leituras
      FROM empresas e
      LEFT JOIN leituras l ON l.empresa_id = e.id
     GROUP BY e.id, e.nome
     ORDER BY leituras DESC
     LIMIT 5
  `);

  const [porSetor] = await db.query(`
    SELECT COALESCE(s.nome, 'Sem setor') AS nome, COUNT(l.id) AS leituras
      FROM leituras l
      LEFT JOIN setores s ON s.id = l.setor_id
     GROUP BY s.id, s.nome
     ORDER BY leituras DESC
  `);

  const [porOperador] = await db.query(`
    SELECT COALESCE(o.nome, 'Nao identificado') AS nome, COUNT(l.id) AS leituras
      FROM leituras l
      LEFT JOIN operadores o ON o.id = l.operador_id
     GROUP BY o.id, o.nome
     ORDER BY leituras DESC
  `);

  return {
    empresas:   empresas.total,
    leituras:   leituras.total,
    operacoes:  operacoes.total,
    relatorios: relatorios.total,
    alertas:    alertas.total,
    operadores: operadores.total,
    drones_disponiveis: drones.total,
    leituras_hoje: hoje.total,
    quantidade_total:   agg.quantidade_total,
    itens_frageis:      agg.itens_frageis,
    produtos_distintos: agg.produtos_distintos,
    locais_distintos:   agg.locais_distintos,
    serie_7d:     serie,
    top_empresas: topEmpresas,
    por_setor:    porSetor,
    por_operador: porOperador
  };
};
