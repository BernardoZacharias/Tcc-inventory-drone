# 🚁 Gestock Drone — Inventário com QR Code

Sistema de gestão de inventário logístico que usa um **drone** para ler QR Codes
de produtos em armazéns. As leituras são enviadas para uma API, armazenadas de
forma estruturada e exibidas em um painel com métricas por empresa.

> Trabalho de Conclusão de Curso — full-stack (React · Node · Python).

---

## Como funciona

```
┌──────────────┐      HTTP/JSON      ┌──────────────┐    spawn("py")    ┌────────────────┐
│   Frontend   │ ──────────────────▶ │   api-node   │ ────────────────▶ │ vision-python  │
│ React + Vite │ ◀────────────────── │  Express 5   │                   │ OpenCV + pyzbar│
└──────────────┘    REST /api/*      └──────┬───────┘                   └───────┬────────┘
                                            │                                    │
                                            ▼            POST /api/leituras      │
                                  ┌──────────────────┐ ◀─────────────────────────┘
                                  │ PostgreSQL       │
                                  │ (Supabase)       │
                                  └──────────────────┘
```

1. O usuário clica em **Iniciar leitura** no painel.
2. A API dispara o script Python passando a empresa por variável de ambiente.
3. O Python captura a tela (onde o vídeo do drone está espelhado via `scrcpy`),
   roda um pipeline OpenCV e decodifica o QR Code com `pyzbar`.
4. Cada leitura nova vira um `POST /api/leituras`.
5. O painel atualiza o feed ao vivo.

---

## Estrutura

| Pasta | Stack | Papel |
|-------|-------|-------|
| `frontend/` | React 19, Vite 8, framer-motion | Painel web (SPA), tema claro/escuro |
| `api-node/` | Node.js, Express 5, PostgreSQL, JWT | API REST + orquestra o scanner |
| `vision-python/` | Python, OpenCV, pyzbar, mss | Visão computacional (leitura do QR) |

---

## Rodando o projeto

**Pré-requisitos:** Node.js 20+, Python 3.10+, e uma conta no Supabase.

### 1. Clone

```bash
git clone https://github.com/BernardoZacharias/Tcc-inventory-drone.git
cd Tcc-inventory-drone
```

### 2. Backend (`api-node`)

```bash
cd api-node
npm install
cp .env.example .env
```

Abra o `.env` e preencha com os dados do **seu** Supabase
(`Project Settings → Database → Connection pooling → Session pooler`).

```bash
npm run db:setup   # cria as tabelas e os dados de exemplo
npm run db:test    # confere a conexão
npm run dev        # http://localhost:3000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

### 4. Visão computacional (opcional)

O backend inicia esse script sozinho quando você clica em "Iniciar leitura".
Para instalar as dependências:

```bash
cd vision-python
pip install -r requirements.txt
```

> `pyzbar` depende da lib nativa **ZBar**.
> Linux: `sudo apt install libzbar0` · macOS: `brew install zbar` · Windows: já vem junto.

### Acesso de demonstração

| E-mail | Senha | Perfil |
|--------|-------|--------|
| `admin@gestock.com.br` | `123456` | admin (vê todas as empresas) |
| `vanderlei@gestock.com.br` | `123456` | operador (vê só a dele) |

---

## Trabalhando em equipe

Este repositório usa duas branches permanentes:

- **`main`** — código estável, apresentável a qualquer momento.
- **`develop`** — integração do trabalho em andamento.

**Nunca commite direto na `main`.** O fluxo completo (nomes de branch, padrão de
commit, como abrir PR) está em **[CONTRIBUTING.md](CONTRIBUTING.md)**.

⚠️ **Nunca versione o arquivo `.env`.** Ele está no `.gitignore` e contém senhas
reais. Use sempre o `.env.example` como referência.

---

## Documentação

- [CONTRIBUTING.md](CONTRIBUTING.md) — fluxo de trabalho em equipe
- [PROXIMOS_PASSOS.md](PROXIMOS_PASSOS.md) — roadmap e pendências priorizadas
- [api-node/MIGRACAO_SUPABASE.md](api-node/MIGRACAO_SUPABASE.md) — detalhes do banco
