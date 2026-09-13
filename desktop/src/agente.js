/*
 * agente.js — controla o Gestock Drone Agent (Python) como sidecar.
 *
 * O app inicia e encerra o Agent; o usuário nunca vê terminal nem
 * precisa saber que por baixo é Python.
 *
 * O interpretador muda de máquina para máquina — `py` no Windows,
 * `python3` no Linux, e o do venv quando existe. Em vez de chutar, a
 * gente PROCURA e testa antes de usar.
 */

const { spawn, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { agente: dirAgente } = require("./paths");

let processo = null;
let ultimoEstado = { rodando: false, saida: [], erro: null };
const LIMITE_LOG = 200;

/** Candidatos a interpretador, do mais específico ao mais genérico. */
function candidatos() {
  const venv = process.platform === "win32"
    ? path.join(dirAgente, ".venv", "Scripts", "python.exe")
    : path.join(dirAgente, ".venv", "bin", "python");

  const lista = [];
  if (fs.existsSync(venv)) lista.push(venv);          // venv do projeto tem prioridade
  if (process.platform === "win32") lista.push("py", "python");
  else lista.push("python3", "python");
  return lista;
}

/** Devolve o primeiro interpretador que realmente executa, ou null. */
function acharPython() {
  for (const cmd of candidatos()) {
    try {
      const r = spawnSync(cmd, ["--version"], { timeout: 8000 });
      if (r.status === 0) return cmd;
    } catch {
      /* tenta o próximo */
    }
  }
  return null;
}

function registrar(linha) {
  ultimoEstado.saida.push(linha);
  if (ultimoEstado.saida.length > LIMITE_LOG) ultimoEstado.saida.shift();
}

/**
 * Inicia o Agent.
 * @param {object} opcoes
 * @param {string} opcoes.driver    flow-ufo | rtsp | usb | file | synthetic
 * @param {string} opcoes.backend   ffmpeg | opencv
 * @param {number} [opcoes.empresaId]
 */
function iniciar(opcoes = {}) {
  if (processo) {
    return { ok: false, mensagem: "O Agent já está em execução." };
  }

  const python = acharPython();
  if (!python) {
    const msg =
      "Python não encontrado nesta máquina. Instale o Python 3.10+ " +
      "ou crie o ambiente em gestock-drone-agent/.venv";
    ultimoEstado.erro = msg;
    return { ok: false, mensagem: msg };
  }

  const args = [
    "-m", "src.main",
    "--driver", opcoes.driver || "flow-ufo",
    "--backend", opcoes.backend || "ffmpeg",
    "--headless",              // a janela de vídeo é do app, não do Python
  ];

  ultimoEstado = { rodando: true, saida: [], erro: null };
  registrar(`$ ${python} ${args.join(" ")}`);

  processo = spawn(python, args, {
    cwd: dirAgente,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1",     // sem isso o log só aparece no fim
      PYTHONIOENCODING: "utf-8",
      ...(opcoes.empresaId ? { EMPRESA_ID: String(opcoes.empresaId) } : {}),
    },
  });

  const consumir = (fluxo) => (dados) => {
    dados.toString().split(/\r?\n/).filter(Boolean).forEach((l) =>
      registrar(fluxo === "err" ? `! ${l}` : l)
    );
  };

  processo.stdout.on("data", consumir("out"));
  processo.stderr.on("data", consumir("err"));

  processo.on("error", (err) => {
    ultimoEstado.rodando = false;
    ultimoEstado.erro = err.message;
    processo = null;
  });

  processo.on("close", (codigo, sinal) => {
    ultimoEstado.rodando = false;
    // SIGILL = binário incompatível com a CPU (numpy/OpenCV).
    // Sem esta tradução o usuário vê só "código null" e não entende nada.
    if (sinal === "SIGILL") {
      ultimoEstado.erro =
        "O Agent morreu com SIGILL: o numpy ou o OpenCV não rodam nesta CPU. " +
        "Rode `python -m src.doctor` na pasta do Agent.";
    } else if (codigo && codigo !== 0) {
      ultimoEstado.erro = `O Agent encerrou com código ${codigo}.`;
    }
    registrar(`— processo encerrado (código ${codigo}, sinal ${sinal || "nenhum"})`);
    processo = null;
  });

  return { ok: true, mensagem: "Agent iniciado.", python };
}

function parar() {
  if (!processo) return { ok: false, mensagem: "O Agent não está em execução." };
  processo.kill();     // o Agent trata SIGTERM e encerra o stream limpo
  processo = null;
  ultimoEstado.rodando = false;
  return { ok: true, mensagem: "Agent encerrado." };
}

function estado() {
  return {
    rodando: Boolean(processo),
    erro: ultimoEstado.erro,
    saida: ultimoEstado.saida.slice(-40),
  };
}

/** Chamado ao fechar o app: não deixar Python órfão rodando. */
function encerrarTudo() {
  if (processo) {
    try {
      processo.kill();
    } catch {
      /* ignora */
    }
    processo = null;
  }
}

module.exports = { iniciar, parar, estado, encerrarTudo, acharPython };
