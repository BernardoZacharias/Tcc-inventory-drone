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
let ultimoEstado = { rodando: false, saida: [], erro: null, porta: null };
const LIMITE_LOG = 200;

/* O Agent escolhe a porta do servidor local (se a 8765 estiver ocupada
 * ele anda para a frente) e anuncia numa linha do stdout. Descobrir
 * assim é melhor que combinar um número fixo: abrir o app duas vezes
 * deixa de ser um conflito. */
const MARCA_PORTA = /^GESTOCK_SERVIDOR porta=(\d+)/;

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

/*
 * Qual decodificador de vídeo usar nesta máquina.
 *
 * Não dá para escolher no chute, porque as duas máquinas do projeto
 * precisam de respostas opostas:
 *
 *   Windows   o OpenCV funciona, e o ffmpeg normalmente NÃO está no PATH
 *   Arch      os binários do OpenCV morrem com SIGILL nesta CPU, e aí
 *             só o ffmpeg do sistema resolve
 *
 * Então a gente PERGUNTA, num subprocesso. Tem que ser em subprocesso:
 * o SIGILL não é uma exceção de Python, é o processo sendo morto pelo
 * sistema — perguntar dentro do próprio Agent derrubaria o Agent.
 */
let backendEmCache = null;

function escolherBackend(python) {
  if (backendEmCache) return backendEmCache;

  try {
    const r = spawnSync(python, ["-c", "import cv2, numpy; cv2.VideoCapture"], {
      timeout: 20000,
      cwd: dirAgente,
    });
    backendEmCache = r.status === 0 ? "opencv" : "ffmpeg";
  } catch {
    backendEmCache = "ffmpeg";
  }

  return backendEmCache;
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

  const backend = opcoes.backend || escolherBackend(python);

  const args = [
    "-m", "src.main",
    "--driver", opcoes.driver || "flow-ufo",
    "--backend", backend,
    "--headless",              // a janela de vídeo é do app, não do Python
    "--servidor",              // publica vídeo e estado em 127.0.0.1
    "--porta", String(opcoes.porta || 8765),
  ];

  // Ler QR é o padrão: quem abre a tela de leitura quer ler, não só ver.
  if (opcoes.qr !== false) {
    args.push("--qr");
    if (opcoes.upscale) args.push("--qr-upscale", String(opcoes.upscale));
    if (opcoes.confirmacoes) args.push("--qr-confirmacoes", String(opcoes.confirmacoes));
  }

  ultimoEstado = { rodando: true, saida: [], erro: null, porta: null };
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
    dados.toString().split(/\r?\n/).filter(Boolean).forEach((l) => {
      const m = MARCA_PORTA.exec(l);
      if (m) ultimoEstado.porta = Number(m[1]);
      registrar(fluxo === "err" ? `! ${l}` : l);
    });
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
  const porta = processo ? ultimoEstado.porta : null;
  return {
    rodando: Boolean(processo),
    erro: ultimoEstado.erro,
    saida: ultimoEstado.saida.slice(-40),
    porta,
    // Prontas para o <img> e o fetch da tela, para o React não ter que
    // montar URL e errar o host.
    urlVideo: porta ? `http://127.0.0.1:${porta}/video` : null,
    urlEstado: porta ? `http://127.0.0.1:${porta}/estado` : null,
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
