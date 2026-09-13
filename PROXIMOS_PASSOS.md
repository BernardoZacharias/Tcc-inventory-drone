# 🚁 Gestock Drone — Revisão do Projeto e Próximos Passos

> Documento de roadmap gerado a partir de uma revisão completa do repositório.
> Data da revisão: **08/07/2026**.

---

## 1. O que é o projeto

**Gestock Drone** é um sistema de **gestão de inventário por leitura de QR Code**, pensado
para ser operado por drones em armazéns / centros de distribuição. Um drone (ou uma câmera)
captura QR Codes de produtos nas prateleiras; cada leitura é enviada para uma API, que a
armazena de forma estruturada e a disponibiliza em um painel web com métricas, empresas,
operadores, operações, relatórios e alertas.

É um projeto **full-stack de TCC**, dividido em três módulos independentes:

| Módulo | Pasta | Stack | Papel |
|--------|-------|-------|-------|
| **Frontend** | `frontend/` | React 19 + Vite 8 + framer-motion + lucide-react | Painel web (SPA). Deploy no Vercel. |
| **Backend / API** | `api-node/` | Node.js + Express 5 + MySQL2 + JWT + bcryptjs | API REST + orquestra o scanner Python. |
| **Visão computacional** | `vision-python/` | Python + OpenCV + pyzbar + mss + requests | Captura a tela, detecta QR Codes e envia leituras à API. |

### Como os módulos conversam

```
┌──────────────┐        HTTP/JSON        ┌──────────────┐      spawn("py")      ┌────────────────┐
│  Frontend    │  ───────────────────▶   │  api-node    │  ─────────────────▶   │ vision-python  │
│  (React/Vite)│  ◀───────────────────   │  (Express)   │                       │ (OpenCV+pyzbar)│
└──────────────┘     REST /api/*         └──────┬───────┘                       └───────┬────────┘
                                                │                                        │
                                                ▼                                        │
                                         ┌──────────────┐        POST /api/leituras      │
                                         │  MySQL        │  ◀─────────────────────────────┘
                                         │ gestock_drone │
                                         └──────────────┘
```

1. O usuário clica em **"Iniciar leitura"** no frontend → `POST /api/leitura/iniciar`.
2. O `api-node` faz `spawn("py", [main.py])` passando `EMPRESA_ID` por variável de ambiente.
3. O `main.py` captura a tela (`mss`), roda um pipeline OpenCV (CLAHE, unsharp, Otsu,
   threshold adaptativo) e decodifica QR Codes com `pyzbar`.
4. A cada QR novo (com *cooldown* de 5s) ele faz `POST /api/leituras` para a API.
5. O frontend lê `/api/leituras`, `/api/stats`, etc. e monta o dashboard.

### Modelo de dados (`api-node/schema.sql`)

`usuarios`, `empresas`, `setores`, `operadores`, `leituras`, `operacoes`, `relatorios`,
`alertas`, `drones` — com escopo por empresa (usuário `admin` vê tudo; `operador` só vê a
própria empresa, aplicado no frontend em `api.js`).

### Estado atual

- ✅ Frontend completo com muitas páginas (Home, Login, Dashboard, Companies, Operations,
  Reports, Alerts, Drones, Readings, Operators, ReadingPanel, About, Technology, Contact).
- ✅ API com CRUD para todas as entidades e autenticação JWT.
- ✅ Scanner Python funcional (protótipo por captura de tela).
- ✅ Pasta `dist/` reconstruída nesta revisão (estava desatualizada).
- ⚠️ Vários pontos de segurança e produção pendentes (ver abaixo).

---

## 2. Correções feitas nesta revisão

- **`frontend/dist/` reconstruída** com `npm run build`. O `dist` antigo estava
  inconsistente: o `index.html` (editado à mão) apontava para `Gestock-Icon.png` e para
  bundles de 20/mai, enquanto o código-fonte já tinha várias páginas novas. Agora o `dist`
  reflete 100% o código atual (2166 módulos), com hashes novos e `favicon.svg` correto.
- **`.gitignore` criado** na raiz — antes **não existia nenhum**. Passa a ignorar
  `node_modules/`, `dist/`, `.env`, `__pycache__/` etc.
- **`api-node/.env.example` criado** como template seguro (sem segredos).

---

## 3. Próximos passos (priorizados)

### 🔴 PRIORIDADE CRÍTICA — Segurança

1. **Senhas em texto puro.** `api-node/src/services/auth.service.js` grava a senha sem hash
   (`INSERT ... senha`) e compara com `senha !== usuario.senha`. O pacote `bcryptjs` já está
   instalado mas **nunca é usado**.
   → No registro: `const hash = await bcrypt.hash(senha, 10);`
   → No login: `const ok = await bcrypt.compare(senha, usuario.senha);`

2. **Segredos versionados / expostos.** O `api-node/.env` contém senha real do banco e
   `JWT_SECRET` fixo. Como não havia `.gitignore`, ele estava prestes a ir para o Git.
   → Já protegido pelo novo `.gitignore`. **Ação:** confirmar que o `.env` **nunca** foi
   commitado (`git log --all -- api-node/.env`); se foi, **rotacionar** a senha do banco e o
   `JWT_SECRET` — trocá-los, não basta remover o arquivo.

3. **Maioria das rotas sem autenticação.** Só `leitura.routes.js` usa `authMiddleware`.
   As rotas de `empresas`, `operadores`, `setores`, `operacoes`, `relatorios`, `alertas`,
   `drones` e `stats` estão **totalmente abertas** — qualquer um lê/escreve sem token.
   O escopo por empresa hoje é aplicado **só no frontend** (`api.js`), o que é burlável.
   → Aplicar `authMiddleware` nas rotas e mover a filtragem por `empresa_id` para o backend.

4. **CORS liberado para todos.** `app.use(cors())` aceita qualquer origem.
   → Restringir: `cors({ origin: process.env.FRONTEND_URL })`.

5. **`spawn` com `shell: true`.** `leitor.service.js` executa `py` com `shell: true`.
   O `EMPRESA_ID` hoje é convertido para número, mas o padrão é arriscado.
   → Preferir `shell: false` e validar/`Number()` a entrada antes.

### 🟠 PRIORIDADE ALTA — Correções que impedem o projeto de rodar do zero

6. **`api-node/schema.sql` está 100% comentado.** Todas as linhas começam com `--`, então
   executá-lo **não cria nada**. Um dev novo não consegue montar o banco.
   → Remover os comentários das linhas de DDL/seed (ou deixar só o cabeçalho comentado).

7. **`vision-python/requirements.txt` está vazio.** As dependências não estão declaradas.
   → Preencher (com base nos `import` de `main.py`):
   ```
   opencv-python
   numpy
   mss
   requests
   pyzbar
   ```
   Observação: `pyzbar` exige a lib nativa **ZBar** instalada no sistema operacional.

8. **API_URL fixa em `localhost`.** Tanto `frontend/src/services/api.js`
   (`http://localhost:3000/api`) quanto `vision-python/src/main.py` apontam para localhost.
   Por isso o site publicado no Vercel **não fala com o backend**.
   → Frontend: usar `import.meta.env.VITE_API_URL` (arquivo `.env` do Vite).
   → Python: usar `os.getenv("API_URL", "http://localhost:3000/api/leituras")`.

### 🟡 PRIORIDADE MÉDIA — Arquitetura e qualidade

9. **`error.middleware.js` existe mas nunca é registrado** em `app.js`. Erros não são
   tratados de forma central.
   → Adicionar `app.use(errorMiddleware)` **depois** das rotas.

10. **Código morto.** `frontend/src/services/localStore.js` (modo demo por localStorage)
    ficou órfão — o cabeçalho de `api.js` afirma que o modo demonstração foi removido.
    → Remover o arquivo, ou reintegrá-lo intencionalmente como fallback offline.

11. **Roteamento por `useState`.** `App.jsx` troca de página com `useState("home")`, sem
    `react-router`. Não há URLs, histórico do navegador, deep-link nem F5 na página certa.
    → Migrar para `react-router-dom` (`/dashboard`, `/companies/:id`, etc.).

12. **Deploy do backend + banco.** Hoje só o frontend está publicado (Vercel). O backend e o
    MySQL rodam apenas na máquina local.
    → Hospedar `api-node` (Railway / Render / Fly.io) e um MySQL gerenciado; setar
    `VITE_API_URL` no Vercel para a URL pública da API.

13. **Dependências muito novas / vulnerabilidades.** React 19.2, Vite 8, ESLint 10 são
    versões de ponta; `npm install` reportou **3 vulnerabilidades (1 low, 1 moderate, 1 high)**.
    → Rodar `npm audit`, avaliar `npm audit fix` e fixar versões estáveis.

### 🟢 PRIORIDADE BAIXA — Melhorias e evolução

14. **README de verdade.** O `README.md` da raiz tem só 2 linhas. Documentar: o que é o
    projeto, pré-requisitos e passo a passo para rodar os 3 módulos (com o `.env.example`).
15. **Testes automatizados** (Jest/Vitest no front, Jest/supertest na API) — hoje não há nenhum.
16. **CI** (GitHub Actions): lint + build + testes em cada push.
17. **Validação de entrada** no backend (ex.: `zod`/`express-validator`) — hoje as rotas
    confiam no corpo recebido.
18. **Fonte de vídeo real.** O `vision-python` captura a **tela** (`mss`), não a câmera do
    drone — é um protótipo. Evoluir para RTSP / webcam / feed do drone.
19. **Feedback de "backend offline".** `api.js` já expõe `backendStatus()`; garantir que o
    componente `BackendBadge` mostre isso de forma clara em todas as telas.

---

## 4. Ordem sugerida de ataque

1. Hash de senha (bcrypt) + proteger rotas com JWT + rotacionar segredos. *(itens 1–4)*
2. Tornar o projeto rodável do zero: descomentar `schema.sql`, preencher `requirements.txt`,
   parametrizar `API_URL`. *(itens 6–8)*
3. Registrar `error.middleware`, remover código morto, escrever o README. *(itens 9, 10, 14)*
4. Deploy do backend + MySQL e apontar o Vercel para a API pública. *(item 12)*
5. `react-router`, testes, CI e demais evoluções. *(itens 11, 15–19)*

---

*Documento gerado durante a revisão do repositório. Sinta-se à vontade para editar as
prioridades conforme os prazos do TCC.*
