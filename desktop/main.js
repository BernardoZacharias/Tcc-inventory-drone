/*
 * main.js — processo principal do Gestock Drone.
 *
 * Junta as três partes do projeto num aplicativo só:
 *
 *   janela (Chromium) ......... o React que já existe (frontend/dist)
 *   processo principal (Node) . a API Express que já existe (api-node)
 *   sidecar ................... o Agent Python (gestock-drone-agent)
 *
 * O usuário abre um ícone. Não há terminal, nem `npm run dev`, nem
 * precisar saber que existe servidor ou Python por baixo.
 */

const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");

const api = require("./src/api-server");
const agente = require("./src/agente");
const caminhos = require("./src/paths");

const DEV = !app.isPackaged && process.env.GESTOCK_DEV === "1";
const URL_DEV = process.env.GESTOCK_DEV_URL || "http://localhost:5173";

let janela = null;
let urlApi = null;

function criarJanela() {
  janela = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#050506",     // evita o flash branco antes do React montar
    show: false,
    title: "Gestock Drone",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,       // o renderer não recebe Node solto
      nodeIntegration: false,
      sandbox: false,
    },
  });

  janela.once("ready-to-show", () => janela.show());

  // Link externo abre no navegador do sistema, não dentro do app
  janela.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (DEV) {
    janela.loadURL(URL_DEV);
    janela.webContents.openDevTools({ mode: "detach" });
  } else {
    janela.loadFile(caminhos.frontendIndex);
  }

  janela.on("closed", () => {
    janela = null;
  });
}

/* ── Ponte com o React ─────────────────────────────────────────── */
ipcMain.handle("gestock:info", () => ({
  versao: app.getVersion(),
  plataforma: process.platform,
  apiUrl: urlApi,
  dev: DEV,
  componentes: caminhos.conferir(),
  python: agente.acharPython(),
}));

ipcMain.handle("agente:iniciar", (_e, opcoes) => agente.iniciar(opcoes || {}));
ipcMain.handle("agente:parar", () => agente.parar());
ipcMain.handle("agente:estado", () => agente.estado());

/* ── Ciclo de vida ─────────────────────────────────────────────── */
app.whenReady().then(async () => {
  try {
    urlApi = await api.iniciar();
  } catch (err) {
    // Sem API o painel não tem dados. Falhar calado seria pior:
    // o usuário veria uma tela vazia sem entender por quê.
    dialog.showErrorBox(
      "Não consegui iniciar a API",
      `${err.message}\n\nO painel vai abrir, mas sem dados. ` +
        `Verifique o arquivo api-node/.env.`
    );
  }

  criarJanela();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Nunca deixar o Python órfão rodando depois que o app fecha
app.on("before-quit", () => agente.encerrarTudo());
app.on("will-quit", async (evento) => {
  agente.encerrarTudo();
  if (api.url()) {
    evento.preventDefault();
    await api.parar();
    app.exit(0);
  }
});
