<#
    instalar.ps1 - prepara o Gestock Drone numa maquina Windows do zero.

    Uso:
        powershell -ExecutionPolicy Bypass -File scripts\instalar.ps1

    Opcoes:
        -SemDesktop   pula o aplicativo Electron (~300 MB de download)
        -SemPython    pula tudo que e Python (so o site e a API)

    O script NAO mexe no banco de dados e NAO grava senha nenhuma.
    Ele deixa o projeto pronto para rodar e diz o que falta fazer.

    -------------------------------------------------------------
    POR QUE EXISTEM DOIS ALVOS DE PYTHON

    Os dois modulos Python deste projeto sao chamados de jeitos
    diferentes, entao instalar num lugar so nao funciona:

      vision-python        a API executa com `py` (o Python GLOBAL),
                           em api-node/src/services/leitor.service.js
      gestock-drone-agent  o aplicativo procura primeiro um .venv
                           dentro da propria pasta do Agent

    Por isso o script instala nos dois lugares.
    -------------------------------------------------------------
#>

param(
    [switch]$SemDesktop,
    [switch]$SemPython
)

$raiz = Split-Path -Parent $PSScriptRoot
$problemas = @()
$avisos    = @()

function Titulo($texto) {
    Write-Host ""
    Write-Host "== $texto" -ForegroundColor Cyan
}
function Ok($texto)    { Write-Host "   [ok]   $texto" -ForegroundColor Green }
function Aviso($texto) { Write-Host "   [!]    $texto" -ForegroundColor Yellow; $script:avisos += $texto }
function Falha($texto) { Write-Host "   [X]    $texto" -ForegroundColor Red;   $script:problemas += $texto }
function Passo($texto) { Write-Host "   ...    $texto" -ForegroundColor DarkGray }

function Existe($comando) {
    $c = Get-Command $comando -ErrorAction SilentlyContinue
    return $null -ne $c
}

# Roda um comando dentro de uma pasta e devolve $true se deu certo.
function Rodar($pasta, $comando, $argumentos) {
    Push-Location $pasta
    try {
        & $comando @argumentos
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    } finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "  Gestock Drone - instalacao" -ForegroundColor White
Write-Host "  $raiz" -ForegroundColor DarkGray

# --------------------------------------------------------------
#  1. Pre-requisitos
# --------------------------------------------------------------
Titulo "1/6  Conferindo o que ja existe nesta maquina"

if (Existe "node") {
    $vNode = (& node --version).Trim()
    $maior = [int]($vNode -replace '^v(\d+).*$', '$1')
    if ($maior -ge 20) {
        Ok "Node.js $vNode"
    } else {
        Falha "Node.js $vNode e antigo demais. O projeto precisa da versao 20 ou maior: https://nodejs.org"
    }
} else {
    Falha "Node.js nao encontrado. Instale a versao LTS: https://nodejs.org"
}

# Qual comando de Python esta disponivel (a ordem importa no Windows)
$python = $null
if (-not $SemPython) {
    foreach ($candidato in @("py", "python", "python3")) {
        if (Existe $candidato) {
            try {
                $saida = (& $candidato --version 2>&1) -join " "
                if ($saida -match "Python (\d+)\.(\d+)") {
                    $maior = [int]$Matches[1]
                    $menor = [int]$Matches[2]
                    if ($maior -eq 3 -and $menor -ge 10) {
                        $python = $candidato
                        Ok "Python $($Matches[1]).$($Matches[2])  (comando: $candidato)"
                        break
                    }
                }
            } catch { }
        }
    }
    if (-not $python) {
        Falha "Python 3.10+ nao encontrado. Instale de https://python.org e MARQUE 'Add python.exe to PATH'"
    }
}

if (Existe "git") { Ok "git" } else { Aviso "git nao encontrado - da para rodar o projeto, mas nao para versionar" }

# O ffmpeg so e necessario se o OpenCV quebrar nesta maquina (--backend ffmpeg)
if (Existe "ffmpeg") {
    Ok "ffmpeg (plano B para o video do drone)"
} else {
    Aviso "ffmpeg ausente. So faz falta se o OpenCV quebrar aqui. Instale depois com: winget install Gyan.FFmpeg"
}

if ($problemas.Count -gt 0) {
    Write-Host ""
    Write-Host "  Faltam pre-requisitos. Resolva os itens [X] acima e rode de novo." -ForegroundColor Red
    Write-Host ""
    exit 1
}

# --------------------------------------------------------------
#  2. API
# --------------------------------------------------------------
Titulo "2/6  API (api-node)"
Passo "npm install - pode demorar alguns minutos"
if (Rodar "$raiz\api-node" "npm" @("install", "--no-fund", "--no-audit")) {
    Ok "dependencias da API instaladas"
} else {
    Falha "npm install falhou em api-node"
}

# O .env guarda a senha do banco e por isso NUNCA vai para o Git.
# Numa maquina nova ele nao existe: criamos a partir do exemplo.
$env_alvo   = "$raiz\api-node\.env"
$env_modelo = "$raiz\api-node\.env.example"
if (Test-Path $env_alvo) {
    Ok ".env ja existe - nao foi tocado"
} elseif (Test-Path $env_modelo) {
    Copy-Item $env_modelo $env_alvo
    Aviso ".env criado a partir do exemplo - VOCE PRECISA preencher a senha do Supabase"
} else {
    Falha ".env.example nao encontrado em api-node"
}

# --------------------------------------------------------------
#  3. Frontend
# --------------------------------------------------------------
Titulo "3/6  Painel web (frontend)"
Passo "npm install"
if (Rodar "$raiz\frontend" "npm" @("install", "--no-fund", "--no-audit")) {
    Ok "dependencias do painel instaladas"
} else {
    Falha "npm install falhou em frontend"
}

# --------------------------------------------------------------
#  4. Aplicativo desktop
# --------------------------------------------------------------
Titulo "4/6  Aplicativo desktop (desktop)"
if ($SemDesktop) {
    Aviso "pulado por -SemDesktop"
} else {
    Passo "npm install - baixa o Electron, ~300 MB"
    if (Rodar "$raiz\desktop" "npm" @("install", "--no-fund", "--no-audit")) {
        Ok "dependencias do aplicativo instaladas"
    } else {
        Falha "npm install falhou em desktop"
    }
}

# --------------------------------------------------------------
#  5. Agent do drone  (venv proprio)
# --------------------------------------------------------------
Titulo "5/6  Agent do drone (gestock-drone-agent)"
if ($SemPython) {
    Aviso "pulado por -SemPython"
} else {
    $pastaAgent = "$raiz\gestock-drone-agent"
    $venv       = "$pastaAgent\.venv"
    $pipVenv    = "$venv\Scripts\python.exe"

    if (-not (Test-Path $pipVenv)) {
        Passo "criando o ambiente isolado (.venv)"
        & $python -m venv $venv
    }

    if (Test-Path $pipVenv) {
        Passo "instalando opencv, numpy, pyzbar, qrcode"
        & $pipVenv -m pip install --upgrade pip --quiet
        & $pipVenv -m pip install -r "$pastaAgent\requirements.txt" --quiet
        if ($LASTEXITCODE -eq 0) {
            Ok "Agent pronto (o aplicativo acha esse .venv sozinho)"
        } else {
            Falha "pip falhou no Agent - rode sem --quiet para ver o erro"
        }
    } else {
        Falha "nao consegui criar o .venv do Agent"
    }
}

# --------------------------------------------------------------
#  6. Scanner de tela  (Python GLOBAL - a API chama com `py`)
# --------------------------------------------------------------
Titulo "6/6  Scanner de tela (vision-python)"
if ($SemPython) {
    Aviso "pulado por -SemPython"
} else {
    Passo "instalando no Python global, porque e assim que a API o executa"
    & $python -m pip install -r "$raiz\vision-python\requirements.txt" --quiet
    if ($LASTEXITCODE -eq 0) {
        Ok "scanner de tela pronto"
    } else {
        Aviso "pip falhou no vision-python - so afeta o botao 'Iniciar leitura' do site"
    }
}

# --------------------------------------------------------------
#  Resumo
# --------------------------------------------------------------
Write-Host ""
Write-Host ("-" * 46) -ForegroundColor DarkGray

if ($problemas.Count -gt 0) {
    Write-Host "  Instalacao terminou COM ERROS:" -ForegroundColor Red
    foreach ($p in $problemas) { Write-Host "    - $p" -ForegroundColor Red }
} else {
    Write-Host "  Instalacao concluida." -ForegroundColor Green
}

if ($avisos.Count -gt 0) {
    Write-Host ""
    Write-Host "  Atencao:" -ForegroundColor Yellow
    foreach ($a in $avisos) { Write-Host "    - $a" -ForegroundColor Yellow }
}

Write-Host ""
Write-Host "  Proximos passos" -ForegroundColor White
Write-Host ""
Write-Host "    1. Preencha a senha do banco em api-node\.env"
Write-Host "       (Supabase > Project Settings > Database > Session pooler)"
Write-Host ""
Write-Host "    2. Confira a conexao e crie as tabelas:"
Write-Host "         cd api-node"
Write-Host "         npm run db:test"
Write-Host "         npm run db:setup"
Write-Host ""
Write-Host "    3. Teste o leitor de QR sem precisar de drone:"
Write-Host "         cd gestock-drone-agent"
Write-Host "         .venv\Scripts\python -m src.main --driver synthetic --qr --headless --duration 10"
Write-Host ""
Write-Host "    4. Rode tudo (dois terminais):"
Write-Host "         cd api-node   ; npm run dev"
Write-Host "         cd frontend   ; npm run dev"
Write-Host ""
Write-Host "    Guia completo de testes: docs\TESTES.md" -ForegroundColor DarkGray
Write-Host ""

if ($problemas.Count -gt 0) { exit 1 }
exit 0
