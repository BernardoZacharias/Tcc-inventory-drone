-- ============================================================
--  GESTOCK DRONE — Schema completo (PostgreSQL / Supabase)
--
--  COMO USAR:
--    1. Acesse o painel do Supabase -> SQL Editor -> New query
--    2. Cole TODO o conteudo deste arquivo e clique em "Run"
--
--  O script e IDEMPOTENTE: pode ser executado varias vezes.
--  Ele RECRIA todas as tabelas (os dados antigos sao apagados)
--  e repopula com os dados de exemplo do final do arquivo.
-- ============================================================

-- ------------------------------------------------
--  Remove as tabelas antigas (CASCADE resolve as FKs)
-- ------------------------------------------------
DROP TABLE IF EXISTS leituras   CASCADE;
DROP TABLE IF EXISTS operadores CASCADE;
DROP TABLE IF EXISTS setores    CASCADE;
DROP TABLE IF EXISTS operacoes  CASCADE;
DROP TABLE IF EXISTS relatorios CASCADE;
DROP TABLE IF EXISTS alertas    CASCADE;
DROP TABLE IF EXISTS drones     CASCADE;
DROP TABLE IF EXISTS empresas   CASCADE;
DROP TABLE IF EXISTS usuarios   CASCADE;

-- ------------------------------------------------
--  USUARIOS  (autenticacao + perfil de acesso)
-- ------------------------------------------------
CREATE TABLE usuarios (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(120) NOT NULL,
  email       VARCHAR(160) NOT NULL UNIQUE,
  senha       VARCHAR(255) NOT NULL,
  perfil      VARCHAR(20)  NOT NULL DEFAULT 'operador'
                CHECK (perfil IN ('admin','operador')),
  empresa_id  INTEGER,                          -- NULL = acesso a todas (admin)
  criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------
--  EMPRESAS  (clientes / contas)
-- ------------------------------------------------
CREATE TABLE empresas (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(160) NOT NULL,
  cnpj        VARCHAR(20),
  segmento    VARCHAR(80),
  responsavel VARCHAR(120),
  email       VARCHAR(160),
  telefone    VARCHAR(30),
  observacao  TEXT,
  ativo       BOOLEAN     NOT NULL DEFAULT TRUE,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK de usuarios -> empresas (criada agora que "empresas" existe)
ALTER TABLE usuarios
  ADD CONSTRAINT fk_usuario_empresa
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL;

-- ------------------------------------------------
--  SETORES  (areas internas de cada empresa)
-- ------------------------------------------------
CREATE TABLE setores (
  id         SERIAL PRIMARY KEY,
  nome       VARCHAR(120) NOT NULL,
  empresa_id INTEGER REFERENCES empresas(id) ON DELETE SET NULL,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------
--  OPERADORES  (quem faz as leituras, com permissoes)
-- ------------------------------------------------
CREATE TABLE operadores (
  id         SERIAL PRIMARY KEY,
  nome       VARCHAR(120) NOT NULL,
  email      VARCHAR(160) UNIQUE,
  senha      VARCHAR(255) DEFAULT '123456',
  empresa_id INTEGER REFERENCES empresas(id) ON DELETE SET NULL,
  setor_id   INTEGER REFERENCES setores(id)  ON DELETE SET NULL,
  permissoes VARCHAR(255) DEFAULT 'leitura',
  ativo      BOOLEAN     NOT NULL DEFAULT TRUE,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------
--  LEITURAS  (QR estruturado: cada campo em sua coluna)
-- ------------------------------------------------
CREATE TABLE leituras (
  id                SERIAL PRIMARY KEY,
  empresa_id        INTEGER REFERENCES empresas(id)   ON DELETE CASCADE,
  operador_id       INTEGER REFERENCES operadores(id) ON DELETE SET NULL,
  setor_id          INTEGER REFERENCES setores(id)    ON DELETE SET NULL,
  codigo_qr         TEXT,                        -- texto bruto original do QR
  produto_id        VARCHAR(60),                 -- dados extraidos do QR:
  nome_produto      VARCHAR(180),
  quantidade        INTEGER,
  fragil            VARCHAR(10),
  empresa_qr        VARCHAR(160),                -- empresa informada no QR
  local_lido        VARCHAR(180),                -- local informado no QR
  origem            VARCHAR(40)  DEFAULT 'DRONE',
  status            VARCHAR(40)  DEFAULT 'lido',
  data_hora_leitura TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  criado_em         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------
--  OPERACOES  (voos / sessoes do drone)
-- ------------------------------------------------
CREATE TABLE operacoes (
  id             SERIAL PRIMARY KEY,
  empresa_id     INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  titulo         VARCHAR(160) NOT NULL,
  descricao      TEXT,
  status         VARCHAR(20) NOT NULL DEFAULT 'agendada'
                   CHECK (status IN ('agendada','em_andamento','concluida','cancelada')),
  piloto         VARCHAR(120),
  area_voo       VARCHAR(120),
  iniciada_em    TIMESTAMPTZ,
  finalizada_em  TIMESTAMPTZ,
  total_leituras INTEGER NOT NULL DEFAULT 0,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------
--  RELATORIOS  (sumarios gerados pelo sistema)
-- ------------------------------------------------
CREATE TABLE relatorios (
  id          SERIAL PRIMARY KEY,
  empresa_id  INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  titulo      VARCHAR(160) NOT NULL,
  tipo        VARCHAR(20) NOT NULL DEFAULT 'customizado'
                CHECK (tipo IN ('diario','semanal','mensal','customizado')),
  periodo_ini DATE,
  periodo_fim DATE,
  total_lidos INTEGER NOT NULL DEFAULT 0,
  total_erros INTEGER NOT NULL DEFAULT 0,
  observacao  TEXT,
  gerado_por  VARCHAR(120),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------
--  ALERTAS  (eventos / notificacoes operacionais)
-- ------------------------------------------------
CREATE TABLE alertas (
  id         SERIAL PRIMARY KEY,
  empresa_id INTEGER REFERENCES empresas(id) ON DELETE SET NULL,
  tipo       VARCHAR(20) NOT NULL DEFAULT 'info'
               CHECK (tipo IN ('info','aviso','critico')),
  mensagem   VARCHAR(255) NOT NULL,
  lido       BOOLEAN     NOT NULL DEFAULT FALSE,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------
--  DRONES  (frota disponivel)
-- ------------------------------------------------
CREATE TABLE drones (
  id          SERIAL PRIMARY KEY,
  modelo      VARCHAR(120) NOT NULL,
  serial      VARCHAR(60) UNIQUE,
  bateria_pct INTEGER NOT NULL DEFAULT 100
                CHECK (bateria_pct BETWEEN 0 AND 100),
  status      VARCHAR(20) NOT NULL DEFAULT 'disponivel'
                CHECK (status IN ('disponivel','voando','manutencao','inativo')),
  ultimo_voo  TIMESTAMPTZ,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------
--  INDICES  (consultas por empresa e por data sao as mais frequentes)
-- ------------------------------------------------
CREATE INDEX idx_leituras_empresa   ON leituras (empresa_id);
CREATE INDEX idx_leituras_operador  ON leituras (operador_id);
CREATE INDEX idx_leituras_setor     ON leituras (setor_id);
CREATE INDEX idx_leituras_data      ON leituras (data_hora_leitura DESC);
CREATE INDEX idx_leituras_produto   ON leituras (produto_id);
CREATE INDEX idx_operadores_empresa ON operadores (empresa_id);
CREATE INDEX idx_setores_empresa    ON setores (empresa_id);
CREATE INDEX idx_operacoes_empresa  ON operacoes (empresa_id);
CREATE INDEX idx_relatorios_empresa ON relatorios (empresa_id);
CREATE INDEX idx_alertas_empresa    ON alertas (empresa_id);
CREATE INDEX idx_alertas_lido       ON alertas (lido);

-- ============================================================
--  SEGURANCA (importante no Supabase)
--
--  O Supabase publica automaticamente uma REST API para as
--  tabelas do schema "public", acessivel com a chave "anon"
--  (que e publica). Habilitar RLS SEM criar policies bloqueia
--  esse acesso externo por completo.
--
--  A nossa API Node conecta com o papel "postgres" (dono das
--  tabelas), que NAO e afetado por RLS -- entao o backend
--  continua funcionando normalmente.
-- ============================================================
ALTER TABLE usuarios   ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE setores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE operadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE leituras   ENABLE ROW LEVEL SECURITY;
ALTER TABLE operacoes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE relatorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE drones     ENABLE ROW LEVEL SECURITY;

-- ============================================================
--  DADOS INICIAIS DE EXEMPLO
-- ============================================================
INSERT INTO empresas (id, nome, cnpj, segmento, responsavel, email) VALUES
  (1, 'Gestock Logistica',    '12.345.678/0001-90', 'Operacao logistica',     'Carlos Lima', 'carlos@gestock.com.br'),
  (2, 'Empresa Alpha',        '98.765.432/0001-11', 'Centro de distribuicao', 'Ana Souza',   'ana@alpha.com.br'),
  (3, 'Cliente Demonstracao', NULL,                 'Estoque tecnico',        NULL,          NULL);

INSERT INTO usuarios (id, nome, email, senha, perfil, empresa_id) VALUES
  (1, 'Administrador',   'admin@gestock.com.br',     '123456', 'admin',    NULL),
  (2, 'Vanderlei Silva', 'vanderlei@gestock.com.br', '123456', 'operador', 2);

INSERT INTO setores (id, nome, empresa_id) VALUES
  (1, 'Recebimento', 2),
  (2, 'Expedicao',   1),
  (3, 'Armazenagem', 1);

INSERT INTO operadores (id, nome, email, senha, empresa_id, setor_id, permissoes) VALUES
  (1, 'Vanderlei Silva', 'vanderlei@gestock.com.br', '123456', 2, 1, 'leitura'),
  (2, 'Carlos Lima',     'carlos@gestock.com.br',    '123456', 1, 2, 'leitura,relatorios');

INSERT INTO drones (id, modelo, serial, bateria_pct, status) VALUES
  (1, 'DJI Mavic 3 Enterprise', 'DJI-MV3-001',  92, 'disponivel'),
  (2, 'Skydio X10',             'SKY-X10-014',  78, 'manutencao'),
  (3, 'Parrot Anafi Ai',        'PRT-ANF-022', 100, 'disponivel');

INSERT INTO alertas (empresa_id, tipo, mensagem, lido) VALUES
  (1, 'info',    'Sistema conectado ao Supabase com sucesso.',      FALSE),
  (2, 'aviso',   'Drone SKY-X10-014 esta em manutencao.',           FALSE),
  (1, 'critico', 'Divergencia de estoque detectada no Corredor B.', FALSE);

INSERT INTO operacoes (empresa_id, titulo, descricao, status, piloto, area_voo, iniciada_em) VALUES
  (1, 'Inventario Corredor A', 'Contagem ciclica semanal', 'concluida',    'Carlos Lima', 'Corredor A', NOW() - INTERVAL '3 days'),
  (2, 'Conferencia Doca 2',    'Recebimento de carga',     'em_andamento', 'Ana Souza',   'Doca 2',     NOW() - INTERVAL '1 day');

-- ------------------------------------------------
--  Leituras de exemplo (QR ja estruturado)
-- ------------------------------------------------
INSERT INTO leituras
  (empresa_id, operador_id, setor_id, codigo_qr, produto_id, nome_produto,
   quantidade, fragil, empresa_qr, local_lido, origem, status, data_hora_leitura)
VALUES
  (1, 2, 2,
   'PRODUTO ID: 12345 Nome: Teclado Logitech Quantidade: 50 Fragil: Nao Empresa: Logitech Local: Corredor A - Prateleira 3',
   '12345', 'Teclado Logitech', 50, 'Nao', 'Logitech', 'Corredor A - Prateleira 3', 'DRONE', 'lido', NOW() - INTERVAL '2 days'),
  (1, 2, 3,
   'PRODUTO ID: 12346 Nome: Monitor Dell 24 Quantidade: 18 Fragil: Sim Empresa: Dell Local: Corredor B - Prateleira 1',
   '12346', 'Monitor Dell 24', 18, 'Sim', 'Dell', 'Corredor B - Prateleira 1', 'DRONE', 'lido', NOW() - INTERVAL '1 day'),
  (2, 1, 1,
   'PRODUTO ID: 20011 Nome: Caixa de Parafusos Quantidade: 200 Fragil: Nao Empresa: Alpha Suprimentos Local: Doca 2 - Pallet 7',
   '20011', 'Caixa de Parafusos', 200, 'Nao', 'Alpha Suprimentos', 'Doca 2 - Pallet 7', 'DRONE', 'lido', NOW());

-- ============================================================
--  SINCRONIZA AS SEQUENCIAS
--
--  Como inserimos IDs explicitos acima, os contadores SERIAL
--  ficariam em 1 e o proximo INSERT quebraria com "duplicate
--  key". Estas chamadas reposicionam cada sequencia.
-- ============================================================
SELECT setval('usuarios_id_seq',   (SELECT COALESCE(MAX(id), 1) FROM usuarios));
SELECT setval('empresas_id_seq',   (SELECT COALESCE(MAX(id), 1) FROM empresas));
SELECT setval('setores_id_seq',    (SELECT COALESCE(MAX(id), 1) FROM setores));
SELECT setval('operadores_id_seq', (SELECT COALESCE(MAX(id), 1) FROM operadores));
SELECT setval('drones_id_seq',     (SELECT COALESCE(MAX(id), 1) FROM drones));
SELECT setval('leituras_id_seq',   (SELECT COALESCE(MAX(id), 1) FROM leituras));
SELECT setval('operacoes_id_seq',  (SELECT COALESCE(MAX(id), 1) FROM operacoes));
SELECT setval('relatorios_id_seq', (SELECT COALESCE(MAX(id), 1) FROM relatorios));
SELECT setval('alertas_id_seq',    (SELECT COALESCE(MAX(id), 1) FROM alertas));

-- ============================================================
--  FIM -- banco pronto para uso
-- ============================================================
