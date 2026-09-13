/*
 * api-server.js — sobe a API Express DENTRO do Electron.
 *
 * O processo principal do Electron é Node. Então o `api-node` que você
 * já tem roda aqui direto, sem processo separado e sem recompilar nada
 * (conferido: ele não usa nenhum módulo nativo — bcryptjs e pg são
 * JavaScript puro).
 *
 * Ganho prático: um executável só. O usuário não precisa abrir terminal,
 * rodar `npm run dev` nem saber que existe um servidor.
 */

const http = require("http");
const path = require("path");
const { apiNode, apiApp, apiEnv } = require("./paths");

const PORTA_INICIAL = 3000;
const MAX_TENTATIVAS = 10;

let servidor = null;
let urlAtual = null;

/** Tenta uma porta. Resolve com o servidor ou null se estiver ocupada. */
function tentarPorta(app, porta) {
  return new Promise((resolve, reject) => {
    const s = http.createServer(app);

    const onErro = (err) => {
      s.removeListener("listening", onOk);
      if (err.code === "EADDRINUSE") return resolve(null);
      reject(err);
    };
    const onOk = () => {
      s.removeListener("error", onErro);
      resolve(s);
    };

    s.once("error", onErro);
    s.once("listening", onOk);
    s.listen(porta, "127.0.0.1");
  });
}

/**
 * Inicia a API. Procura uma porta livre a partir da 3000 — se o dev
 * estiver com `npm run dev` aberto, o app não quebra, só usa a próxima.
 * Devolve a URL base real.
 */
async function iniciar() {
  if (urlAtual) return urlAtual;

  // O .env do api-node carrega as credenciais do Supabase.
  require("dotenv").config({ path: apiEnv });

  // O app.js usa caminhos relativos; garantimos o cwd certo.
  const cwdAnterior = process.cwd();
  try {
    process.chdir(apiNode);
  } catch {
    /* em app empacotado o chdir pode falhar; os requires usam caminho absoluto */
  }

  let app;
  try {
    app = require(apiApp);
  } finally {
    try {
      process.chdir(cwdAnterior);
    } catch {
      /* ignora */
    }
  }

  for (let i = 0; i < MAX_TENTATIVAS; i++) {
    const porta = PORTA_INICIAL + i;
    const s = await tentarPorta(app, porta);
    if (s) {
      servidor = s;
      urlAtual = `http://127.0.0.1:${porta}`;
      console.log(`[api] rodando em ${urlAtual}`);
      return urlAtual;
    }
    console.log(`[api] porta ${porta} ocupada, tentando a próxima...`);
  }

  throw new Error(
    `nenhuma porta livre entre ${PORTA_INICIAL} e ${PORTA_INICIAL + MAX_TENTATIVAS - 1}`
  );
}

function parar() {
  return new Promise((resolve) => {
    if (!servidor) return resolve();
    servidor.close(() => {
      servidor = null;
      urlAtual = null;
      resolve();
    });
  });
}

const url = () => urlAtual;

module.exports = { iniciar, parar, url };
