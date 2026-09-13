/*
 * preload.js — a ÚNICA ponte entre o React e o Node.
 *
 * A janela roda com contextIsolation e sem nodeIntegration: o React não
 * enxerga `require`, `fs` nem `process`. Isso é proposital — se um dia
 * o painel carregar conteúdo de terceiro, ele não ganha acesso à máquina.
 *
 * Aqui exponho só o que o painel precisa, com nomes explícitos.
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gestock", {
  /** Roda dentro do aplicativo (e não no navegador). */
  desktop: true,

  /** Versão, plataforma, URL da API e o que foi encontrado na instalação. */
  info: () => ipcRenderer.invoke("gestock:info"),

  agente: {
    iniciar: (opcoes) => ipcRenderer.invoke("agente:iniciar", opcoes),
    parar: () => ipcRenderer.invoke("agente:parar"),
    estado: () => ipcRenderer.invoke("agente:estado"),
  },
});
