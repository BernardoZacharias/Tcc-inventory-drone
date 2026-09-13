/*
 * db.js
 * -----
 * Conexao com o PostgreSQL (Supabase).
 *
 * Este modulo expoe a MESMA interface que o mysql2/promise usava
 * antes da migracao, para que todos os services continuem escritos
 * com placeholders `?` e com o retorno no formato [rows, info]:
 *
 *     const [rows]      = await db.query("SELECT * FROM empresas");
 *     const [[um]]      = await db.query("SELECT COUNT(*) AS total ...");
 *     const [r]         = await db.query("INSERT INTO ...", [...]);
 *     r.insertId  ->  id gerado pelo PostgreSQL
 *
 * Internamente ele traduz `?` para `$1, $2, ...` e adiciona
 * `RETURNING id` nos INSERTs para emular o insertId do MySQL.
 */

const { Pool, types } = require("pg");
require("dotenv").config();

/* ------------------------------------------------------------
   1. Tipos numericos
   ------------------------------------------------------------
   O driver "pg" devolve BIGINT (int8) e NUMERIC como STRING para
   nao perder precisao. Como o nosso dominio usa contagens pequenas
   (COUNT, SUM de quantidade), isso faria o front receber "12" em
   vez de 12 e quebrar somas e graficos.
   Convertendo aqui, o comportamento fica igual ao do MySQL.        */
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));   // int8
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));   // numeric

/* ------------------------------------------------------------
   2. Configuracao da conexao
   ------------------------------------------------------------
   Aceita das duas formas:
     a) DATABASE_URL = postgresql://usuario:senha@host:5432/postgres
     b) DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
   A opcao (a) tem prioridade e e a recomendada para o Supabase.     */
const conexaoPorUrl = !!process.env.DATABASE_URL;

const config = conexaoPorUrl
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host:     process.env.DB_HOST,
      port:     Number(process.env.DB_PORT) || 5432,
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    };

/* O Supabase exige TLS. O certificado e assinado por uma CA propria,
   entao usamos rejectUnauthorized:false (padrao em conexoes de app
   com Supabase). Para desativar em um Postgres local: DB_SSL=false. */
if (process.env.DB_SSL !== "false") {
  config.ssl = { rejectUnauthorized: false };
}

config.max = Number(process.env.DB_POOL_MAX) || 10;
config.idleTimeoutMillis = 30000;
config.connectionTimeoutMillis = 15000;

const pool = new Pool(config);

pool.on("error", (err) => {
  console.error("[DB] Erro inesperado no pool de conexoes:", err.message);
});

/* ------------------------------------------------------------
   3. Tradutor de placeholders  ?  ->  $1, $2, $3 ...
   ------------------------------------------------------------
   Percorre a query caractere a caractere e ignora as interrogacoes
   que estiverem dentro de strings, de identificadores entre aspas
   duplas ou de comentarios de linha e de bloco.                    */
function converterPlaceholders(sql) {
  let saida = "";
  let indice = 0;

  let emString = false;      // dentro de '...'
  let emIdent = false;       // dentro de "..."
  let emComentarioLinha = false;
  let emComentarioBloco = false;

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const prox = sql[i + 1];

    if (emComentarioLinha) {
      saida += c;
      if (c === "\n") emComentarioLinha = false;
      continue;
    }
    if (emComentarioBloco) {
      saida += c;
      if (c === "*" && prox === "/") {
        saida += prox;
        i++;
        emComentarioBloco = false;
      }
      continue;
    }
    if (emString) {
      saida += c;
      // '' escapa uma aspa simples dentro da string
      if (c === "'" && prox === "'") {
        saida += prox;
        i++;
      } else if (c === "'") {
        emString = false;
      }
      continue;
    }
    if (emIdent) {
      saida += c;
      if (c === '"') emIdent = false;
      continue;
    }

    if (c === "-" && prox === "-") { emComentarioLinha = true; saida += c; continue; }
    if (c === "/" && prox === "*") { emComentarioBloco = true; saida += c; continue; }
    if (c === "'") { emString = true; saida += c; continue; }
    if (c === '"') { emIdent = true; saida += c; continue; }

    if (c === "?") {
      indice++;
      saida += "$" + indice;
      continue;
    }

    saida += c;
  }

  return saida;
}

/* Detecta um INSERT sem RETURNING, para conseguirmos devolver o
   insertId como o mysql2 fazia. */
function precisaReturningId(sql) {
  const limpo = sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").trim();
  return /^insert\s+into/i.test(limpo) && !/\breturning\b/i.test(limpo);
}

/* ------------------------------------------------------------
   4. query() compativel com o mysql2/promise
   ------------------------------------------------------------ */
async function query(sql, params = []) {
  let texto = converterPlaceholders(sql);
  let pediuReturning = false;

  if (precisaReturningId(texto)) {
    texto = texto.replace(/;\s*$/, "") + " RETURNING id";
    pediuReturning = true;
  }

  let resultado;
  try {
    resultado = await pool.query(texto, params);
  } catch (err) {
    // Mensagem de erro util no console, mantendo o erro original
    console.error("[DB] Falha na query:", err.message);
    console.error("[DB] SQL:", texto.trim().split("\n")[0]);
    throw err;
  }

  // O mysql2/promise devolve [linhas, campos] para SELECT, mas
  // [ResultSetHeader, campos] para INSERT/UPDATE/DELETE -- e o
  // ResultSetHeader e quem carrega o .insertId. Reproduzimos isso:
  const header = {
    insertId: pediuReturning && resultado.rows[0] ? resultado.rows[0].id : undefined,
    affectedRows: resultado.rowCount,
    rowCount: resultado.rowCount,
    command: resultado.command
  };

  // SELECT (e afins) -> primeiro elemento e o array de linhas.
  if (["SELECT", "SHOW", "WITH"].includes(resultado.command)) {
    return [resultado.rows, resultado.fields];
  }

  // INSERT / UPDATE / DELETE -> primeiro elemento imita o header,
  // para que `const [r] = await db.query(...); r.insertId` funcione.
  return [header, resultado.fields];
}

/* Executa varias queries dentro da mesma transacao. */
async function transacao(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await callback(client);
    await client.query("COMMIT");
    return r;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/* Testa a conexao — usado pelo server.js na inicializacao. */
async function testarConexao() {
  const [rows] = await query("SELECT NOW() AS agora, current_database() AS banco");
  return rows[0];
}

module.exports = { query, transacao, testarConexao, pool };
