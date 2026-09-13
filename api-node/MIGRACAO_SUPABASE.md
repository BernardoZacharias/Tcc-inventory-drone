# Migração para Supabase / PostgreSQL

Este documento resume a migração do banco do **Gestock Drone** de
**MySQL** para **PostgreSQL (Supabase)** e explica como rodar.

## O que mudou

| Antes (MySQL) | Depois (PostgreSQL / Supabase) |
|---------------|--------------------------------|
| driver `mysql2` | driver `pg` |
| `src/config/db.js` com `mysql.createPool` | `src/config/db.js` com `pg.Pool` + camada de compatibilidade |
| `schema.sql` (comentado, não executável) | `schema.postgres.sql` (executável e idempotente) |
| `AUTO_INCREMENT`, `TINYINT(1)`, `ENUM` | `SERIAL`, `BOOLEAN`, `CHECK (... IN ...)` |
| `CURDATE()`, `DATE_SUB`, `DATE(col)` | `CURRENT_DATE`, `- INTERVAL`, `col::date` |
| conexão local `localhost:3306` | Supabase via **Session Pooler** (IPv4) |

**Importante:** os arquivos de *services*, *controllers* e *routes*
**não precisaram ser reescritos**. A camada `db.js` traduz os
placeholders `?` → `$1, $2, ...` e emula o `insertId` do MySQL
(via `RETURNING id`), mantendo a mesma interface
`const [rows] = await db.query(...)`.

## Como rodar (do zero)

```bash
cd api-node
npm install
cp .env.example .env      # e preencha com os dados do seu Supabase
npm run db:setup          # cria as tabelas e popula dados de exemplo
npm run db:test           # confere a conexão e lista as tabelas
npm run dev               # sobe a API em http://localhost:3000
```

Depois, em outro terminal:

```bash
cd frontend
npm install
npm run dev               # abre o painel em http://localhost:5173
```

## Scripts de banco

- `npm run db:test` — testa a conexão e mostra a contagem de cada tabela.
- `npm run db:setup` — (re)cria todo o schema e os dados de exemplo.
  **Atenção:** apaga e recria as tabelas do Gestock.

Alternativa sem terminal: abra o **SQL Editor** no painel do Supabase,
cole o conteúdo de [`schema.postgres.sql`](schema.postgres.sql) e clique em **Run**.

## Conexão: por que o "Session Pooler"?

O host direto `db.<ref>.supabase.co` publica **apenas IPv6**. Em redes
só-IPv4 (a maioria), a conexão direta falha com timeout. O **Session
Pooler** (`aws-0-<região>.pooler.supabase.com`) responde em **IPv4** e é
estável. O usuário do pooler é `postgres.<ref-do-projeto>`.

A `DATABASE_URL` do `.env` já está configurada com o pooler correto
(região `us-east-1`). Para trocar de rede/projeto, ajuste só essa linha.

## Usuários de exemplo (login)

| E-mail | Senha | Perfil |
|--------|-------|--------|
| admin@gestock.com.br | 123456 | admin (vê todas as empresas) |
| vanderlei@gestock.com.br | 123456 | operador (só a Empresa Alpha) |

## Segurança — pendências (ver `../PROXIMOS_PASSOS.md`)

A migração **não** alterou as questões de segurança já mapeadas:
senha em texto puro, rotas sem `authMiddleware` e filtro por empresa
apenas no frontend. As **credenciais do Supabase** foram compartilhadas
em texto — recomenda-se usar **"Reset database password"** no painel
depois de validar tudo.
