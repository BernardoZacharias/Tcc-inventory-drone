/*
 * smoke.js — teste de fumaça do aplicativo, sem abrir janela.
 *
 *   npm run smoke
 *
 * Responde às perguntas que decidem se o app funciona:
 *
 *   1. A API Express sobe DENTRO do Electron?
 *   2. Ela responde de verdade (rota e banco)?
 *   3. Os três componentes (frontend, api, agent) estão no lugar?
 *   4. Existe Python para rodar o Agent?
 *
 * Roda sob o Electron (`electron scripts/smoke.js`), porque é o único
 * jeito de testar o processo principal de verdade.
 */

const { app } = require("electron");
const http = require("http");

const api = require("../src/api-server");
const agente = require("../src/agente");
const caminhos = require("../src/paths");

const OK = "[ ok ]";
const FALHA = "[FALHA]";
let problemas = 0;

function pedir(url, timeout = 8000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout }, (res) => {
      let corpo = "";
      res.on("data", (c) => (corpo += c));
      res.on("end", () => resolve({ status: res.statusCode, corpo }));
    });
    req.on("error", (e) => resolve({ erro: e.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ erro: "timeout" });
    });
  });
}

function checar(condicao, textoOk, textoFalha) {
  if (condicao) {
    console.log(`${OK} ${textoOk}`);
  } else {
    console.log(`${FALHA} ${textoFalha}`);
    problemas++;
  }
  return condicao;
}

app.whenReady().then(async () => {
  console.log("\n=== Gestock Drone — teste de fumaça do aplicativo ===\n");

  console.log("-- componentes no disco --");
  const c = caminhos.conferir();
  checar(c.frontend, "frontend/dist/index.html", "frontend não foi construído (npm run build:frontend)");
  checar(c.api, "api-node/src/app.js", "api-node não encontrado");
  checar(c.env, "api-node/.env", "api-node/.env ausente (a API não acha o banco)");
  checar(c.agente, "gestock-drone-agent/src/main.py", "Agent não encontrado");

  console.log("\n-- Python para o Agent --");
  const py = agente.acharPython();
  checar(py, `interpretador: ${py}`, "Python não encontrado (o Agent não vai iniciar)");

  console.log("\n-- API Express dentro do Electron --");
  let url = null;
  try {
    url = await api.iniciar();
    checar(true, `subiu em ${url}`, "");
  } catch (err) {
    checar(false, "", `não subiu: ${err.message}`);
  }

  if (url) {
    const raiz = await pedir(`${url}/`);
    checar(
      raiz.status === 200,
      `GET / responde ${raiz.status} — "${(raiz.corpo || "").slice(0, 40)}"`,
      `GET / falhou: ${raiz.erro || raiz.status}`
    );

    // Esta rota consulta o banco: prova a cadeia Electron → Express → Supabase
    const empresas = await pedir(`${url}/api/empresas`);
    let total = null;
    try {
      total = JSON.parse(empresas.corpo).data?.length;
    } catch {
      /* resposta não-JSON */
    }
    checar(
      empresas.status === 200 && typeof total === "number",
      `GET /api/empresas responde 200 com ${total} empresa(s) — banco acessível`,
      `GET /api/empresas falhou: ${empresas.erro || empresas.status}`
    );
  }

  console.log("\n=== conclusão ===");
  if (problemas === 0) {
    console.log("Tudo pronto. O aplicativo deve abrir com `npm start`.\n");
  } else {
    console.log(`${problemas} problema(s) acima. O app abre, mas incompleto.\n`);
  }

  await api.parar();
  agente.encerrarTudo();
  app.exit(problemas === 0 ? 0 : 1);
});
