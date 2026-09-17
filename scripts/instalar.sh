#!/usr/bin/env bash
#
# instalar.sh — prepara o Gestock Drone numa maquina Linux ou macOS do zero.
#
#     bash scripts/instalar.sh
#
# Opcoes:
#     --sem-desktop   pula o aplicativo Electron (~300 MB de download)
#     --sem-python    pula tudo que e Python (so o site e a API)
#
# O script NAO mexe no banco de dados e NAO grava senha nenhuma.
# Ele deixa o projeto pronto para rodar e diz o que falta fazer.
#
# ─────────────────────────────────────────────────────────────
# POR QUE EXISTEM DOIS ALVOS DE PYTHON
#
# Os dois modulos Python deste projeto sao chamados de jeitos
# diferentes, entao instalar num lugar so nao funciona:
#
#   vision-python        a API executa com o Python do sistema, em
#                        api-node/src/services/leitor.service.js
#   gestock-drone-agent  o aplicativo procura primeiro um .venv
#                        dentro da propria pasta do Agent
#
# Por isso o script instala nos dois lugares. Em distros que
# bloqueiam o pip global (PEP 668: Arch, Debian 12+, Ubuntu 24.04)
# ele avisa e mostra a saida correta em vez de quebrar.
# ─────────────────────────────────────────────────────────────

set -u

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SEM_DESKTOP=0
SEM_PYTHON=0

for arg in "$@"; do
  case "$arg" in
    --sem-desktop) SEM_DESKTOP=1 ;;
    --sem-python)  SEM_PYTHON=1 ;;
    -h|--help)     sed -n '3,12p' "$0"; exit 0 ;;
    *) echo "Opcao desconhecida: $arg"; exit 1 ;;
  esac
done

if [ -t 1 ]; then
  C_AZUL=$'\033[36m'; C_VERDE=$'\033[32m'; C_AMAR=$'\033[33m'
  C_VERM=$'\033[31m'; C_CINZA=$'\033[90m'; C_OFF=$'\033[0m'
else
  C_AZUL=""; C_VERDE=""; C_AMAR=""; C_VERM=""; C_CINZA=""; C_OFF=""
fi

PROBLEMAS=(); AVISOS=()

titulo() { printf '\n%s== %s%s\n' "$C_AZUL" "$1" "$C_OFF"; }
ok()     { printf '   %s[ok]%s   %s\n' "$C_VERDE" "$C_OFF" "$1"; }
aviso()  { printf '   %s[!]%s    %s\n' "$C_AMAR" "$C_OFF" "$1"; AVISOS+=("$1"); }
falha()  { printf '   %s[X]%s    %s\n' "$C_VERM" "$C_OFF" "$1"; PROBLEMAS+=("$1"); }
passo()  { printf '   %s...    %s%s\n' "$C_CINZA" "$1" "$C_OFF"; }
tem()    { command -v "$1" >/dev/null 2>&1; }

printf '\n  Gestock Drone - instalacao\n'
printf '  %s%s%s\n' "$C_CINZA" "$RAIZ" "$C_OFF"

# ──────────────────────────────────────────────────────────────
#  1. Pre-requisitos
# ──────────────────────────────────────────────────────────────
titulo "1/6  Conferindo o que ja existe nesta maquina"

if tem node; then
  V_NODE="$(node --version)"
  MAIOR="${V_NODE#v}"; MAIOR="${MAIOR%%.*}"
  if [ "$MAIOR" -ge 20 ] 2>/dev/null; then
    ok "Node.js $V_NODE"
  else
    falha "Node.js $V_NODE e antigo demais. O projeto precisa da versao 20 ou maior."
  fi
else
  falha "Node.js nao encontrado. Arch: sudo pacman -S nodejs npm | Ubuntu: sudo apt install nodejs npm"
fi

PYTHON=""
if [ "$SEM_PYTHON" -eq 0 ]; then
  for c in python3 python; do
    if tem "$c"; then
      if "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)' 2>/dev/null; then
        PYTHON="$c"
        ok "Python $("$c" -c 'import sys; print("%d.%d" % sys.version_info[:2])')  (comando: $c)"
        break
      fi
    fi
  done
  [ -n "$PYTHON" ] || falha "Python 3.10+ nao encontrado. Arch: sudo pacman -S python | Ubuntu: sudo apt install python3 python3-venv"
fi

tem git && ok "git" || aviso "git nao encontrado - da para rodar, mas nao para versionar"

# O pyzbar depende da lib nativa ZBar. No Windows ela vem junto; aqui nao.
if [ "$SEM_PYTHON" -eq 0 ]; then
  if ldconfig -p 2>/dev/null | grep -q libzbar || [ -f /usr/local/lib/libzbar.dylib ] \
     || [ -f /opt/homebrew/lib/libzbar.dylib ]; then
    ok "ZBar (biblioteca nativa que o pyzbar usa)"
  else
    aviso "ZBar ausente - sem ela o pyzbar nao le QR. Arch: sudo pacman -S zbar | Ubuntu: sudo apt install libzbar0 | macOS: brew install zbar"
  fi
fi

if tem ffmpeg; then
  ok "ffmpeg (plano B para o video do drone)"
else
  aviso "ffmpeg ausente. Arch: sudo pacman -S ffmpeg | Ubuntu: sudo apt install ffmpeg"
fi

if [ "${#PROBLEMAS[@]}" -gt 0 ]; then
  printf '\n  %sFaltam pre-requisitos. Resolva os itens [X] acima e rode de novo.%s\n\n' "$C_VERM" "$C_OFF"
  exit 1
fi

# ──────────────────────────────────────────────────────────────
#  2. API
# ──────────────────────────────────────────────────────────────
titulo "2/6  API (api-node)"
passo "npm install - pode demorar alguns minutos"
if (cd "$RAIZ/api-node" && npm install --no-fund --no-audit); then
  ok "dependencias da API instaladas"
else
  falha "npm install falhou em api-node"
fi

# O .env guarda a senha do banco e por isso NUNCA vai para o Git.
# Numa maquina nova ele nao existe: criamos a partir do exemplo.
if [ -f "$RAIZ/api-node/.env" ]; then
  ok ".env ja existe - nao foi tocado"
elif [ -f "$RAIZ/api-node/.env.example" ]; then
  cp "$RAIZ/api-node/.env.example" "$RAIZ/api-node/.env"
  aviso ".env criado a partir do exemplo - VOCE PRECISA preencher a senha do Supabase"
else
  falha ".env.example nao encontrado em api-node"
fi

# ──────────────────────────────────────────────────────────────
#  3. Frontend
# ──────────────────────────────────────────────────────────────
titulo "3/6  Painel web (frontend)"
passo "npm install"
if (cd "$RAIZ/frontend" && npm install --no-fund --no-audit); then
  ok "dependencias do painel instaladas"
else
  falha "npm install falhou em frontend"
fi

# ──────────────────────────────────────────────────────────────
#  4. Aplicativo desktop
# ──────────────────────────────────────────────────────────────
titulo "4/6  Aplicativo desktop (desktop)"
if [ "$SEM_DESKTOP" -eq 1 ]; then
  aviso "pulado por --sem-desktop"
else
  passo "npm install - baixa o Electron, ~300 MB"
  if (cd "$RAIZ/desktop" && npm install --no-fund --no-audit); then
    ok "dependencias do aplicativo instaladas"
  else
    falha "npm install falhou em desktop"
  fi
fi

# ──────────────────────────────────────────────────────────────
#  5. Agent do drone  (venv proprio)
# ──────────────────────────────────────────────────────────────
titulo "5/6  Agent do drone (gestock-drone-agent)"
if [ "$SEM_PYTHON" -eq 1 ]; then
  aviso "pulado por --sem-python"
else
  AGENT="$RAIZ/gestock-drone-agent"
  PY_VENV="$AGENT/.venv/bin/python"

  if [ ! -x "$PY_VENV" ]; then
    passo "criando o ambiente isolado (.venv)"
    "$PYTHON" -m venv "$AGENT/.venv" || \
      aviso "falhou criar o venv. Ubuntu/Debian precisam de: sudo apt install python3-venv"
  fi

  if [ -x "$PY_VENV" ]; then
    passo "instalando opencv, numpy, pyzbar, qrcode"
    "$PY_VENV" -m pip install --upgrade pip --quiet
    if "$PY_VENV" -m pip install -r "$AGENT/requirements.txt" --quiet; then
      ok "Agent pronto (o aplicativo acha esse .venv sozinho)"
    else
      falha "pip falhou no Agent - rode sem --quiet para ver o erro"
    fi
  else
    falha "nao consegui criar o .venv do Agent"
  fi
fi

# ──────────────────────────────────────────────────────────────
#  6. Scanner de tela  (Python do sistema - e assim que a API o chama)
# ──────────────────────────────────────────────────────────────
titulo "6/6  Scanner de tela (vision-python)"
if [ "$SEM_PYTHON" -eq 1 ]; then
  aviso "pulado por --sem-python"
else
  passo "instalando no Python do sistema, porque e assim que a API o executa"
  SAIDA="$("$PYTHON" -m pip install -r "$RAIZ/vision-python/requirements.txt" --quiet 2>&1)" && CODIGO=0 || CODIGO=$?

  if [ "$CODIGO" -eq 0 ]; then
    ok "scanner de tela pronto"
  elif printf '%s' "$SAIDA" | grep -q "externally-managed-environment"; then
    # Arch, Debian 12+, Ubuntu 24.04: o pip global e bloqueado de proposito.
    aviso "esta distro bloqueia o pip global (PEP 668). Use: sudo pacman -S python-opencv python-pyzbar  (ou o gerenciador da sua distro)"
  else
    aviso "pip falhou no vision-python - so afeta o botao 'Iniciar leitura' do site"
  fi
fi

# ──────────────────────────────────────────────────────────────
#  Resumo
# ──────────────────────────────────────────────────────────────
printf '\n%s──────────────────────────────────────────────%s\n' "$C_CINZA" "$C_OFF"

if [ "${#PROBLEMAS[@]}" -gt 0 ]; then
  printf '  %sInstalacao terminou COM ERROS:%s\n' "$C_VERM" "$C_OFF"
  for p in "${PROBLEMAS[@]}"; do printf '    %s- %s%s\n' "$C_VERM" "$p" "$C_OFF"; done
else
  printf '  %sInstalacao concluida.%s\n' "$C_VERDE" "$C_OFF"
fi

if [ "${#AVISOS[@]}" -gt 0 ]; then
  printf '\n  %sAtencao:%s\n' "$C_AMAR" "$C_OFF"
  for a in "${AVISOS[@]}"; do printf '    %s- %s%s\n' "$C_AMAR" "$a" "$C_OFF"; done
fi

cat <<FIM

  Proximos passos

    1. Preencha a senha do banco em api-node/.env
       (Supabase > Project Settings > Database > Session pooler)

    2. Confira a conexao e crie as tabelas:
         cd api-node
         npm run db:test
         npm run db:setup

    3. Teste o leitor de QR sem precisar de drone:
         cd gestock-drone-agent
         .venv/bin/python -m src.main --driver synthetic --qr --headless --duration 10

    4. Rode tudo (dois terminais):
         cd api-node && npm run dev
         cd frontend && npm run dev

    Guia completo de testes: docs/TESTES.md

FIM

[ "${#PROBLEMAS[@]}" -gt 0 ] && exit 1
exit 0
