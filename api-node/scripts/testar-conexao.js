/*
 * testar-conexao.js
 * -----------------
 * Verifica se a API consegue conversar com o PostgreSQL (Supabase).
 *
 *     npm run db:test
 *
 * Mostra a versao do servidor, o banco conectado e quais tabelas
 * do Gestock ja existem (com a contagem de registros de cada uma).
 */

require("dotenv").config();
const db = require("../src/config/db");

const TABELAS = [
  "usuarios", "empresas", "setores", "operadores",
  "leituras", "operacoes", "relatorios", "alertas", "drones"
];

(async () => {
  console.log("\n== Teste de conexao - Gestock Drone ==\n");

  const alvo = process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace(/:\/\/([^:]+):[^@]*@/, "://$1:*****@")
    : `${process.env.DB_USER}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
  console.log("Destino:", alvo, "\n");

  try {
    const [info] = await db.query(
      "SELECT current_database() AS banco, version() AS versao, NOW() AS agora"
    );
    console.log("[OK] Conectado com sucesso!");
    console.log("     Banco :", info[0].banco);
    console.log("     Server:", String(info[0].versao).split(" ").slice(0, 2).join(" "));
    console.log("     Hora  :", info[0].agora.toISOString(), "\n");
  } catch (err) {
    console.error("[ERRO] Nao foi possivel conectar:", err.message, "\n");
    if (err.code === "ENETUNREACH" || err.code === "ETIMEDOUT") {
      console.error("  Causa provavel: a conexao DIRETA do Supabase (db.<ref>.supabase.co)");
      console.error("  exige IPv6, e a sua rede e IPv4.");
      console.error("  Solucao: use o 'Session pooler' (IPv4). Veja as instrucoes no .env.\n");
    }
    if (err.code === "ENOTFOUND") {
      console.error("  Causa provavel: host incorreto ou projeto Supabase pausado.\n");
    }
    if (/password authentication failed/i.test(err.message)) {
      console.error("  Causa provavel: senha do banco incorreta no .env.\n");
    }
    await db.pool.end();
    process.exit(1);
  }

  // -- Tabelas do projeto --
  console.log("Tabelas do projeto:");
  let faltando = 0;

  for (const t of TABELAS) {
    try {
      const [linhas] = await db.query(`SELECT COUNT(*) AS total FROM ${t}`);
      console.log(`  [ok] ${t.padEnd(12)} ${linhas[0].total} registro(s)`);
    } catch (err) {
      if (err.code === "42P01") {
        console.log(`  [--] ${t.padEnd(12)} NAO EXISTE`);
        faltando++;
      } else {
        console.log(`  [!!] ${t.padEnd(12)} ${err.message}`);
      }
    }
  }

  if (faltando > 0) {
    console.log(`\n${faltando} tabela(s) faltando. Rode:  npm run db:setup\n`);
  } else {
    console.log("\nTudo certo. O banco esta pronto para uso.\n");
  }

  await db.pool.end();
})();
