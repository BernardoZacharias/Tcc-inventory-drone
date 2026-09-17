# Revisão do frontend — Gestock como aplicativo

Data: 13/09/2026. Base inspecionada: `2047777`.

## Resultado

O login foi corrigido preservando a cena do galpão e a identidade visual atual. A revisão também identificou e corrigiu a seleção do endereço da API no aplicativo, o gerenciamento de foco, mensagens de diagnóstico e uma busca sem feedback.

Esta é uma revisão do frontend operacional e de seus pontos de contato com o Electron. Não é uma certificação de segurança, de funcionamento do drone ou do instalador em outras máquinas.

## Problemas corrigidos

### 1. Campos de login com duas superfícies

Os utilitários Tailwind estavam em camadas CSS, enquanto as regras genéricas de `polish.css` eram aplicadas fora de camadas. Os inputs recebiam novamente fundo, borda, sombra e `padding: 12px 15px`, apesar da superfície externa já existente.

Antes da correção, a inspeção do navegador confirmou borda interna de 1px e espaçamento duplicado. Depois da correção, os inputs têm borda e padding internos zerados; o contorno, o fundo e o foco pertencem ao conjunto completo do campo.

Implementação: `frontend/src/styles/LoginAccess.css` e `frontend/src/pages/Login.jsx`.

- Campos flexíveis com largura mínima zero para não empurrar o ícone de senha.
- Ícones e textos alinhados; botão de senha com alvo de 44 × 44px.
- Estados normal, foco, erro e desabilitado coerentes com os tokens claro/escuro.
- Tratamento visual do preenchimento automático e foco em cores forçadas. Estes dois modos têm regras específicas, mas não foram exercitados com gerenciador de senhas ou modo de alto contraste do Windows.
- Espaçamento do formulário adaptado às telas menores.
- Regras restritas ao login, sem reescrever os formulários operacionais.

### 2. Foco perdido na entrada e nas falhas

O `autoFocus` do e-mail era substituído pelo foco global no título em `App.jsx`. Agora o login sinaliza seu campo inicial para o roteamento: em janelas de pelo menos 1024px, o e-mail recebe foco; em telas menores, mantém-se o foco no título, sem abrir o teclado virtual automaticamente.

Erros de validação levam ao primeiro campo inválido. Erros do servidor recebem foco no aviso, permitindo continuar pelo teclado. O botão de mostrar senha também fica desabilitado enquanto a autenticação está em andamento.

### 3. Frontend preso à porta 3000 no Electron

`desktop/src/api-server.js` procura uma porta livre entre 3000 e 3009. O frontend usava somente a configuração web/porta 3000 e ignorava `window.gestock.info().apiUrl`.

O novo `frontend/src/services/apiEndpoint.js` resolve o endereço informado pelo Electron antes das requisições do login, pré-voo e painel. No navegador, mantém `VITE_API_URL` e o fallback já existente.

A resolução compartilha chamadas simultâneas, tem limite de espera e permite tentar novamente após falhas. No desktop, não envia credenciais a um servidor de fallback quando a ponte não responde. Há testes para porta alternativa, falha, timeout e chamada real do cliente de API com resposta simulada.

### 4. Diagnóstico de pré-voo impreciso

Em `usePreflight`, uma falha da API também marcava o banco como inacessível, sem evidência direta. Encontrar Python era anunciado como leitor “pronto”.

Agora o banco fica “não verificado” quando não é possível confirmá-lo. Respostas 401/403 significam serviço acessível com autenticação necessária. A presença do interpretador aparece como “Python encontrado”, sem afirmar que câmera, dependências ou drone estão prontos.

As requisições HTTP são canceladas ao sair da página; a checagem do Python não espera a conclusão da consulta ao banco e tem limite de espera.

### 5. Busca de operadores sem resultado

A mensagem de vazio considerava a lista original, não a lista filtrada. Uma busca sem correspondência deixava um painel vazio. Agora aparece “Nenhum operador corresponde à busca”.

### 6. Validação técnica desatualizada

O lint acusava `process` indefinido no arquivo de configuração do Vite. O ambiente Node foi declarado para configurações e testes, preservando o ambiente de navegador no frontend.

A prévia isolada passou a carregar Tailwind, o login atual e a preferência de tema. Foram incluídas respostas locais simuladas de autenticação inválida, indisponibilidade e demora. Essa prévia não lê, grava ou encaminha credenciais e não aciona equipamentos.

## Cobertura da revisão visual e de interação

As telas foram inspecionadas no Chromium com o código React atual. Para as áreas autenticadas, foram usadas fixtures locais, sem criar uma sessão real nem alterar dados do banco.

| Área | Verificações realizadas |
| --- | --- |
| Login | Claro/escuro; digitação; senha visível/oculta; campos vazios; erro de acesso; HTTP 503; timeout; reabilitação dos controles; foco; larguras 1280, 1024, 390 e 320px |
| Dashboard | Métricas com dados, zeros confirmados e indisponibilidade indicada por “—”; gráfico e listas; adaptação à janela mínima e tela pequena |
| Empresas | Formulário, listagem, mensagens de vazio/erro e contenção da tabela com rolagem horizontal em tela pequena |
| Operações | Formulário, filtros, cartões e estados vazio/erro |
| Relatórios | Formulário, intervalo de datas, histórico e estados vazio/erro |
| Alertas | Formulário, filtros, cartões e estados vazio/erro |
| Drones | Formulário, bateria, seletor de status e estados vazio/erro; nenhum comando enviado |
| Operadores e setores | Formulários, listagem, busca sem correspondência e estados vazio/erro |
| Histórico de leituras | Métricas, filtros, cartões e estados vazio/erro |
| Painel da empresa | Contexto da empresa, métricas, leituras e estados vazio/erro |
| Scanner | Seleção de empresa pelo teclado, carregamento, estado desconhecido, registro manual, Escape e devolução de foco; nenhum comando enviado |
| Navegação compartilhada | Menu compacto, foco dentro do diálogo, Escape e retorno ao botão que abriu o menu |

Na inspeção das áreas operacionais a 1024 × 640 e 390 × 844px, não houve vazamento horizontal do documento. A tabela de empresas mantém rolagem interna para alcançar as ações. Os controles do login também permaneceram dentro do formulário a 320px.

As páginas institucionais continuam no projeto web, mas o roteamento desktop as redireciona ao login/dashboard. Não foram objeto de uma nova auditoria visual completa nesta rodada.

## Pendências identificadas — não implementadas nesta rodada

### Prioridade alta: scanner ainda ligado ao leitor antigo

O frontend chama `/api/leitura/iniciar`, `/parar` e `/status`. Em `api-node/src/services/leitor.service.js`, essas rotas controlam `vision-python/src/main.py`. Já `desktop/preload.js` expõe o novo Agent por `window.gestock.agente` e `desktop/src/agente.js` usa `gestock-drone-agent`.

Portanto, a interface não está integrada ao novo Agent. O instalador documentado inclui o novo Agent, mas o botão ainda depende do caminho antigo. É necessário definir um único contrato de iniciar/parar/estado, incluindo empresa, driver, falhas e confirmação de encerramento. A troca envolve backend, processo principal e equipamento; não foi feita como ajuste visual.

### Prioridade média: sessão e permissões

`App.jsx` reconhece sessão pela presença de usuário e token no armazenamento. O cliente avisa sobre HTTP 401, mas não oferece um fluxo central de reautenticação. `utils/auth.js` também mantém inferência de administrador pelo e-mail, e a navegação não representa todas as permissões configuradas por operador.

Revisar a experiência de sessão expirada e alinhar menus ao perfil/permissões retornados pelo servidor. A autorização real precisa permanecer na API; esconder botões não substitui esse controle. Não foi realizada auditoria completa de autorização do backend.

### Prioridade média: tipografia offline e organização dos estilos

O `frontend/index.html` carrega fontes do Google Fonts. Sem rede/cache, o aplicativo depende das fontes alternativas, podendo mudar medidas e quebras de linha. Avaliar empacotar as fontes usadas pelo produto.

Ainda coexistem CSS legado, camadas de refinamento e Tailwind. O login agora está isolado, mas uma consolidação gradual de componentes de formulário evitaria novos conflitos. O antigo `Login.css` permanece no repositório, sem importação pela página de acesso atual.

### Prioridade média: inicialização e diagnóstico desktop

O canal `gestock:info` executa descoberta de Python com chamadas síncronas no processo principal. A lentidão dessa descoberta pode atrasar também a informação do endereço da API. Avaliar separar metadados essenciais de diagnóstico e executar a descoberta de forma assíncrona/cacheada.

O comando existente `npm run smoke` confirmou componentes, Python, API e consulta ao banco. Porém, após imprimir a conclusão positiva, permaneceu aguardando encerramento; o processo de teste foi interrompido. Não deve ser tratado como execução integral concluída com código zero. O encerramento do teste/API precisa de diagnóstico separado.

### Evolução: carregamento por rota

`App.jsx` importa antecipadamente todas as páginas, inclusive as institucionais que o aplicativo não exibe. Avaliar carregamento por rota ou entradas web/desktop separadas. O build desktop desta revisão gerou aproximadamente 494kB de JavaScript e 170kB de CSS antes de compressão; não foi realizado benchmark de desempenho em máquinas de operação.

## Verificação e entrega

- `npm run lint`: aprovado.
- `npm test`: 23 testes aprovados.
- `git diff --check`: sem erros de whitespace; Git informa apenas normalização de CRLF/LF no login.
- `npm run build:frontend`, em `desktop`: aprovado, com assets relativos em `frontend/dist`.
- `npm run smoke`: verificações internas positivas, com ressalva de encerramento descrita acima.
- Nenhum login real, cadastro, exclusão, mudança de status operacional ou acionamento de drone foi executado.
- O frontend foi preparado para o app local; um novo instalador não foi gerado. Uma versão já instalada não recebe estas alterações automaticamente.
- Ainda falta validação ponta a ponta da autenticação real, do novo Agent e do aplicativo instalado em uma máquina de destino.
