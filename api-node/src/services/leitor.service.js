const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let processoPython = null;
let leituraAtiva = false;

exports.iniciarLeitura = (empresaId) => {
  if (leituraAtiva) {
    return {
      sucesso: false,
      mensagem: "Leitura já está em execução"
    };
  }

  const caminhoPython = path.resolve(
    __dirname,
    "../../../vision-python/src/main.py"
  );

  if (!fs.existsSync(caminhoPython)) {
    return {
      sucesso: false,
      mensagem: `Arquivo Python não encontrado: ${caminhoPython}`
    };
  }

  console.log("Iniciando leitura para empresa:", empresaId);
  console.log("Arquivo Python:", caminhoPython);

processoPython = spawn("py", [caminhoPython], {
  shell: true,
  env: {
    ...process.env,
    EMPRESA_ID: String(empresaId),
    PYTHONIOENCODING: "utf-8"
  }
});

  leituraAtiva = true;

  processoPython.stdout.on("data", (data) => {
    console.log(`PYTHON: ${data.toString()}`);
  });

  processoPython.stderr.on("data", (data) => {
    console.error(`ERRO PYTHON: ${data.toString()}`);
  });

  processoPython.on("error", (error) => {
    leituraAtiva = false;
    processoPython = null;
    console.error("Erro ao executar Python:", error);
  });

  processoPython.on("close", (code) => {
    leituraAtiva = false;
    processoPython = null;
    console.log("Processo Python encerrado. Código:", code);
  });

  return {
    sucesso: true,
    mensagem: "Leitura iniciada com sucesso"
  };
};

exports.pararLeitura = () => {
  if (!processoPython) {
    return {
      sucesso: false,
      mensagem: "Nenhuma leitura em execução"
    };
  }

  processoPython.kill();
  processoPython = null;
  leituraAtiva = false;

  return {
    sucesso: true,
    mensagem: "Leitura encerrada com sucesso"
  };
};

exports.statusLeitura = () => {
  return {
    sucesso: true,
    ativa: leituraAtiva
  };
};