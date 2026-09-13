/*
 * paths.js — onde cada parte do projeto mora.
 *
 * Em desenvolvimento, `desktop/` é irmã de `frontend/`, `api-node/` e
 * `gestock-drone-agent/`. No app empacotado, esses diretórios são
 * copiados para dentro dos "resources" do instalador.
 *
 * Centralizar aqui evita caminho quebrado quando vira .exe — que é o
 * erro clássico de app Electron: funciona no `npm start` e quebra
 * instalado.
 */

const path = require("path");
const fs = require("fs");
const { app } = require("electron");

const empacotado = app.isPackaged;

/** Raiz de onde saem frontend/, api-node/ e gestock-drone-agent/. */
const raiz = empacotado
  ? process.resourcesPath
  : path.resolve(__dirname, "..", "..");

const caminhos = {
  empacotado,
  raiz,
  frontendDist: path.join(raiz, "frontend", "dist"),
  frontendIndex: path.join(raiz, "frontend", "dist", "index.html"),
  apiNode: path.join(raiz, "api-node"),
  apiApp: path.join(raiz, "api-node", "src", "app.js"),
  apiEnv: path.join(raiz, "api-node", ".env"),
  agente: path.join(raiz, "gestock-drone-agent"),
};

/** Confere o que existe — usado no diagnóstico da tela inicial. */
function conferir() {
  return {
    frontend: fs.existsSync(caminhos.frontendIndex),
    api: fs.existsSync(caminhos.apiApp),
    env: fs.existsSync(caminhos.apiEnv),
    agente: fs.existsSync(path.join(caminhos.agente, "src", "main.py")),
  };
}

module.exports = { ...caminhos, conferir };
