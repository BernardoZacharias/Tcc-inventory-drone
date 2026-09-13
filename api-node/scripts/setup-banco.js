/*
 * setup-banco.js
 * --------------
 * Executa o schema.postgres.sql no banco configurado no .env.
 *
 *     npm run db:setup
 *
 * ATENCAO: o script RECRIA as tabelas do Gestock (DROP + CREATE).
 * Todos os dados existentes nessas tabelas sao apagados e
 * substituidos pelos dados de exemplo do schema.
 *
 * Alternativa sem terminal: copiar o conteudo de schema.postgres.sql
 * e colar no SQL Editor do painel do Supabase.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("../src/config/db");

const ARQUIVO = path.resolve(__dirname, "../schema.postgres.sql");

(async () => {
  console.log("\n== Setup do banco - Gestock Drone ==\n");

  if (!fs.existsSync(ARQUIVO)) {
    console.error("[ERRO] schema.postgres.sql nao encontrado em:", ARQUIVO, "\n");
    process.exit(1);
  }

  const sql = fs.readFileSync(ARQUIVO, "utf8");
  console.log("Arquivo :", path.basename(ARQUIVO));
  console.log("Destino :", process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace(/:\/\/([^:]+):[^@]*@/, "://$1:*****@")
    : `${process.env.DB_HOST}/${process.env.DB_NAME}`);
  console.log("\nExecutando (isso RECRIA as tabelas)...\n");

  const client = await db.pool.connect();
  try {
    // Sem parametros, o driver aceita varios comandos numa unica chamada.
    await client.query(sql);
    console.log("[OK] Schema aplicado com sucesso.\n");
  } catch (err) {
    console.error("[ERRO] Falha ao aplicar o schema:", err.message);
    if (err.position) console.error("       Posicao no arquivo:", err.position);
    console.error("");
    client.release();
    await db.pool.end();
    process.exit(1);
  }

  // -- Conferencia rapida --
  const tabelas = ["usuarios", "empresas", "setores", "operadores",
                   "leituras", "operacoes", "relatorios", "alertas", "drones"];
  console.log("Conferencia:");
  for (const t of tabelas) {
    const r = await client.query(`SELECT COUNT(*) AS total FROM ${t}`);
    console.log(`  ${t.padEnd(12)} ${r.rows[0].total} registro(s)`);
  }

  console.log("\nUsuarios para login:");
  console.log("  admin@gestock.com.br      / 123456   (perfil admin)");
  console.log("  vanderlei@gestock.com.br  / 123456   (perfil operador)\n");

  client.release();
  await db.pool.end();
})();
