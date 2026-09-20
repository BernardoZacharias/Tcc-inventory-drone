# 🚁 Gestock Drone — Inventário com QR Code

Sistema de inventário para armazéns em que um **drone** sobrevoa as
prateleiras lendo QR Codes dos produtos. As leituras viram registros
estruturados e aparecem num painel com métricas por empresa.

> Trabalho de Conclusão de Curso — full-stack (React · Node · Python · Electron).

---

## Os cinco módulos

| Pasta | Stack | Papel |
|-------|-------|-------|
| `frontend/` | React 19, Vite 8, Tailwind 4 | Painel web (SPA), tema claro/escuro |
| `api-node/` | Node 20+, Express 5, PostgreSQL, JWT | API REST e dono das regras de negócio |
| `gestock-drone-agent/` | Python, OpenCV, pyzbar | **Agent**: fala com o drone e lê os QR na borda |
| `desktop/` | Electron | Empacota painel + API + Agent num aplicativo instalável |
| `vision-python/` | Python, OpenCV, mss | Scanner de tela — o protótipo original, ainda usado pelo site |

### Por que existem dois módulos de visão

O `vision-python` captura a **tela** do computador (onde o vídeo do drone
está espelhado). Funciona, mas depende de alguém espelhar a tela.

O `gestock-drone-agent` fala **direto com o drone** por RTSP e processa o
vídeo na própria máquina. Isso é *edge computing*, e não é preciosismo: a
nuvem não consegue alcançar o `192.168.1.1` do drone, que é um endereço
da rede privada dele. Quem estiver perto do drone tem que fazer o
trabalho.

```
┌──────────────┐     HTTP/JSON     ┌──────────────┐
│   Frontend   │ ────────────────▶ │   api-node   │ ──▶ PostgreSQL (Supabase)
│  React/Vite  │ ◀──────────────── │  Express 5   │
└──────────────┘    REST /api/*    └──────┬───────┘
                                          │ spawn
                    ┌─────────────────────┴───────────────────┐
                    ▼                                         ▼
          ┌──────────────────┐                    ┌───────────────────────┐
          │  vision-python   │                    │  gestock-drone-agent  │
          │  captura a tela  │                    │  RTSP direto do drone │
          └──────────────────┘                    └───────────┬───────────┘
                                                              │ Wi-Fi do drone
                                                              ▼
                                                        🚁 FLOW-UFO
```

---

## Instalação numa máquina nova

Um script cuida de tudo: confere pré-requisitos, instala as dependências
dos cinco módulos e diz o que falta fazer.

**Windows:**

```bash
git clone https://github.com/BernardoZacharias/Tcc-inventory-drone.git
cd Tcc-inventory-drone
powershell -ExecutionPolicy Bypass -File scripts\instalar.ps1
```

**Linux / macOS:**

```bash
git clone https://github.com/BernardoZacharias/Tcc-inventory-drone.git
cd Tcc-inventory-drone
bash scripts/instalar.sh
```

Opções: `-SemDesktop` / `--sem-desktop` pula o Electron (~300 MB) e
`-SemPython` / `--sem-python` instala só o site e a API.

**Pré-requisitos:** Node.js 20+, Python 3.10+ e uma conta no Supabase.
O script avisa se algum faltar, com o comando de instalação da sua
plataforma.

### Depois do script

O `.env` guarda a senha do banco e por isso **nunca** vai para o Git —
numa máquina nova ele nasce vazio:

```bash
# 1. preencha api-node/.env com os dados do SEU Supabase
#    (Project Settings → Database → Connection pooling → Session pooler)

cd api-node
npm run db:test     # conectou?
npm run db:setup    # cria tabelas e dados de exemplo
```

Pronto. Para rodar:

```bash
cd api-node   && npm run dev     # http://localhost:3000
cd frontend   && npm run dev     # http://localhost:5173
cd desktop    && npm start       # o aplicativo
```

### Acesso de demonstração

| E-mail | Senha | Perfil |
|--------|-------|--------|
| `admin@gestock.com.br` | `123456` | admin (vê todas as empresas) |
| `vanderlei@gestock.com.br` | `123456` | operador (vê só a dele) |

> Estas são as senhas que o **`npm run db:setup` cria**. Se a senha foi
> trocada direto no banco depois disso, vale a do banco — o seed não é
> reaplicado. Para conferir qual está valendo:
>
> ```bash
> cd api-node && node -e "require('dotenv').config();const db=require('./src/config/db');(async()=>{const [r]=await db.query('SELECT email, perfil FROM usuarios');console.table(r);process.exit(0)})()"
> ```

---

## Testando

O teste mais rápido não precisa de drone, câmera nem internet:

```bash
cd gestock-drone-agent
.venv\Scripts\python -m src.main --driver synthetic --qr --headless --duration 10
```

Deve ler 1 código e ignorar as repetições. O guia completo — dos testes
automáticos até o voo com o drone — está em **[docs/TESTES.md](docs/TESTES.md)**.

---

## Estado atual

| Parte | Situação |
|-------|----------|
| Painel web, API, banco no Supabase | ✅ funcionando |
| Aplicativo desktop + instalador Windows | ✅ funcionando |
| Agent: vídeo do drone, reconexão automática | ✅ marco 1 |
| Agent: leitura de QR confirmada e sem repetição | ✅ marco 2 |
| Aplicativo: tela de voo com a câmera do drone ao vivo | ✅ funcionando |
| Agent: fila offline em SQLite e registro no estoque | ✅ marco 3 |
| Agent: sincronismo com a nuvem | ⬜ marco 4 (depende de uma VPS) |
| Agent: empacotar como `.exe` | ⬜ marco 5 |

Pendências conhecidas — inclusive de segurança — estão priorizadas em
[docs/PROXIMOS_PASSOS.md](docs/PROXIMOS_PASSOS.md).

---

## Trabalhando em equipe

Duas branches permanentes:

- **`main`** — código estável, apresentável a qualquer momento.
- **`develop`** — integração do trabalho em andamento.

**Nunca commite direto na `main`.** O fluxo completo está em
**[CONTRIBUTING.md](CONTRIBUTING.md)**.

⚠️ **Nunca versione o arquivo `.env`.** Ele contém senha real e já está
no `.gitignore`. Use o `.env.example` como referência.

---

## Documentação

| Documento | Para quê |
|-----------|----------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | fluxo de trabalho em equipe |
| [docs/TESTES.md](docs/TESTES.md) | como testar cada parte |
| [docs/PROXIMOS_PASSOS.md](docs/PROXIMOS_PASSOS.md) | roadmap e pendências |
| [gestock-drone-agent/README.md](gestock-drone-agent/README.md) | o Agent em detalhe |
| [desktop/README.md](desktop/README.md) | o aplicativo instalável |
| [api-node/MIGRACAO_SUPABASE.md](api-node/MIGRACAO_SUPABASE.md) | detalhes do banco |
| [docs/ESPECIFICACAO_DASHBOARD.md](docs/ESPECIFICACAO_DASHBOARD.md) | especificação do painel |
| [docs/REVISAO_FRONTEND_APLICATIVO.md](docs/REVISAO_FRONTEND_APLICATIVO.md) | revisão da interface |
