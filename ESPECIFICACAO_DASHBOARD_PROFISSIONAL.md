# Gestock Control Tower

## Especificação funcional e estratégica da dashboard profissional

> Documento de definição de produto e experiência da página principal do Gestock.
>
> Esta especificação deve orientar o desenho, a prototipação e a validação da dashboard antes de qualquer alteração no código.

---

## 1. Objetivo deste documento

Antes de alterar o frontend, o backend ou o banco de dados, a dashboard deve ser tratada como um produto profissional. É necessário definir exatamente:

- qual problema ela resolve;
- quais decisões o usuário precisa tomar;
- quais informações devem aparecer;
- quais ações estarão disponíveis;
- como a interface se comportará em cada estado;
- como a inteligência artificial participará da experiência;
- como o produto se adaptará a cada perfil e dispositivo.

Esta especificação considera como página principal a dashboard exibida após o login, atualmente representada por `frontend/src/pages/Dashboard.jsx`.

---

## 2. O que o mercado espera atualmente

Uma dashboard profissional de logística não pode ser apenas um conjunto de números e gráficos. Ela precisa funcionar como uma central de comando operacional, ou **Control Tower**.

O modelo mais adequado para o Gestock é:

1. **Ver:** o que está acontecendo agora?
2. **Entender:** por que aconteceu?
3. **Decidir:** qual problema deve ser priorizado?
4. **Agir:** o que o usuário pode fazer imediatamente?

Essa abordagem é adotada no conceito moderno de supply chain control tower: visibilidade em tempo real, detecção de exceções, priorização e ação operacional. A SAP descreve o ciclo como “ver, decidir e agir”.

Fonte: [Supply Chain Control Towers — SAP](https://www.sap.com/uk/resources/supply-chain-control-tower)

O mercado de armazenagem também está avançando para automação, detecção de anomalias, segurança e previsão. Em uma pesquisa da Zebra com mais de 1.700 profissionais, 63% dos líderes planejavam implementar IA e realidade aumentada; os principais impactos esperados estavam em segurança, controle de qualidade, detecção de anomalias e inventário.

Fonte: [Warehousing Vision Study — Zebra](https://www.zebra.com/us/en/about-zebra/newsroom/press-releases/2025/70-of-frontline-workers-report-rising-concerns-with-injuries-on-the-warehouse-floor.html)

Portanto, uma dashboard competitiva deve oferecer:

- visão operacional realmente atualizada;
- dados confiáveis e com horário da última sincronização;
- filtros globais e visualizações personalizadas;
- indicadores comparados com metas e períodos anteriores;
- alertas que permitam agir;
- drill-down do indicador até o registro responsável;
- rastreabilidade;
- diferentes experiências por perfil;
- funcionamento em desktop, tablet e celular;
- acessibilidade;
- explicações e recomendações com IA;
- exportação e compartilhamento;
- estados claros de carregamento, ausência de dados, erro e conexão parcial.

Uma dashboard deve responder a uma pergunta, contar uma história do geral para o específico, reduzir a carga cognitiva e oferecer drill-downs.

Fonte: [Dashboard best practices — Grafana](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/)

---

## 3. Posicionamento recomendado para o Gestock

A dashboard não deveria ser apresentada apenas como um painel de gerenciamento de empresas e leituras.

O posicionamento recomendado é:

> **Gestock Control Tower — Central inteligente de inventário, rastreabilidade e operações com drone.**

Isso muda o foco do produto. Em vez de apenas cadastrar entidades, a plataforma passa a responder:

- A operação está saudável?
- Quanto do inventário planejado já foi conferido?
- Existem divergências?
- Onde estão os problemas?
- Qual drone está operando?
- Qual área ainda não foi coberta?
- Qual ação deve ser tomada agora?
- A informação é confiável e atual?
- O que a IA identificou que uma pessoa poderia não perceber?

---

## 4. Pontos que precisam melhorar no projeto

### 4.1 Prioridade 0 — Fundamentos do negócio

Antes de criar indicadores avançados, o modelo de dados precisa sustentar esses indicadores.

#### 4.1.1 Cadastro mestre de produtos

Hoje o produto existe apenas dentro de cada leitura. O sistema deverá futuramente possuir:

- produto;
- SKU;
- GTIN/EAN;
- descrição;
- categoria;
- unidade de medida;
- quantidade esperada;
- lote;
- número de série;
- validade;
- características de armazenamento;
- indicador de fragilidade;
- empresa proprietária.

O mercado utiliza padrões GS1 para identificação e rastreabilidade. O GS1 Digital Link permite conectar GTIN, GLN e SSCC a informações digitais e APIs.

Fonte: [GS1 Digital Link](https://www.gs1.org/standards/gs1-digital-link)

#### 4.1.2 Estrutura física do armazém

O sistema precisa representar:

- unidade ou filial;
- armazém;
- setor;
- corredor;
- módulo;
- prateleira;
- posição;
- capacidade;
- coordenadas ou mapa lógico.

Sem essa estrutura não é possível medir a cobertura real de uma operação.

#### 4.1.3 Inventário planejado

Uma operação precisa saber o que deveria encontrar:

- snapshot do estoque esperado;
- produtos esperados por posição;
- quantidades esperadas;
- posições planejadas;
- tolerâncias;
- data de referência;
- fonte do dado: ERP, WMS, CSV ou entrada manual.

Somente com essa referência será possível calcular divergência, cobertura e conformidade.

#### 4.1.4 Relacionamento completo da leitura

Cada leitura deve estar ligada a:

- empresa;
- operação;
- drone;
- operador;
- setor;
- posição;
- produto;
- tentativa de leitura;
- origem;
- data e hora;
- nível de confiança;
- imagem ou evidência;
- resultado da validação;
- possível duplicidade.

Hoje o scanner envia essencialmente empresa e QR, deixando operação, drone, setor e operador sem vínculo confiável.

#### 4.1.5 Identidade e permissões

Atualmente `usuarios` e `operadores` são estruturas separadas. Essas identidades precisarão ser unificadas ou relacionadas.

Perfis recomendados:

- administrador da plataforma;
- gestor da empresa;
- supervisor de inventário;
- operador;
- auditor;
- somente leitura.

Cada permissão e ação crítica deve ser validada no backend, não apenas escondida no frontend.

### 4.2 Prioridade 1 — Evolução da dashboard

A dashboard atual destaca:

- quantidade de empresas;
- quantidade de leituras;
- operações;
- operadores;
- drones;
- alertas.

Esses números são úteis administrativamente, mas não respondem à principal pergunta operacional.

Os indicadores principais deveriam ser:

- progresso do inventário;
- conformidade ou acuracidade;
- divergências abertas;
- posições cobertas;
- operação ativa;
- condição da frota.

Quantidade de empresas, usuários e relatórios pode permanecer em páginas administrativas ou em uma visão secundária.

### 4.3 Prioridade 2 — Tempo real e confiabilidade

O sistema atual usa diversas consultas periódicas no frontend. A evolução profissional deverá incluir:

- endpoint consolidado para a dashboard;
- WebSocket ou Server-Sent Events para eventos operacionais;
- atualização inteligente conforme a frequência dos dados;
- indicador de última atualização;
- estado de dado desatualizado;
- tratamento de sincronização parcial;
- cache;
- monitoramento do scanner;
- heartbeat do drone ou processo;
- histórico de disponibilidade.

Atualizar constantemente não significa necessariamente tempo real. O usuário precisa saber se o dado está atualizado e se a fonte está saudável.

### 4.4 Prioridade 3 — Alertas acionáveis

Um alerta profissional precisa ter:

- severidade;
- entidade afetada;
- impacto;
- horário;
- tempo em aberto;
- responsável;
- SLA;
- explicação;
- ação recomendada;
- histórico;
- status.

Ações possíveis:

- reconhecer;
- atribuir responsável;
- silenciar temporariamente;
- abrir ocorrência;
- resolver;
- informar motivo da resolução;
- consultar registros relacionados.

Um alerta sem ação associada é apenas uma notificação.

### 4.5 Prioridade 4 — IA útil, não decorativa

O mercado já espera consultas e resumos em linguagem natural. O Power BI, por exemplo, permite perguntar sobre o relatório aberto e gerar resumos contextuais.

Fonte: [Copilot for Power BI](https://learn.microsoft.com/en-ie/power-bi/create-reports/copilot-introduction)

No Gestock, a IA deverá ter cinco funções:

1. **Resumir:** “O que aconteceu nesta operação?”
2. **Detectar:** “Quais padrões ou anomalias foram encontrados?”
3. **Explicar:** “Por que a conformidade caiu?”
4. **Recomendar:** “Qual setor deve ser revisitado?”
5. **Consultar:** “Mostre os produtos frágeis com divergência no corredor B.”

A IA não deve executar ações operacionais irreversíveis silenciosamente.

Cada resposta precisa informar:

- período analisado;
- empresa e operação consideradas;
- fontes utilizadas;
- horário dos dados;
- confiança;
- registros que sustentam a conclusão;
- limitações;
- possibilidade de corrigir ou rejeitar o resultado.

As diretrizes da Microsoft recomendam mostrar o que a IA consegue fazer, o quanto ela é confiável, por que tomou determinada decisão e permitir correção, rejeição e controle global.

Fonte: [Microsoft HAX Toolkit](https://www.microsoft.com/en-us/haxtoolkit/library/)

O NIST também recomenda que riscos de IA sejam tratados durante todo o ciclo de vida do produto.

Fonte: [NIST AI RMF — Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)

---

## 5. Especificação da página principal

### 5.1 Nome da página

**Visão Operacional**

Subtítulo sugerido:

> Acompanhe inventários, divergências, operações e a saúde da frota em tempo real.

### 5.2 Objetivo da página

Em até dez segundos, o usuário deve conseguir responder:

- Está tudo funcionando?
- Existe alguma situação crítica?
- Qual operação está ativa?
- Quanto já foi concluído?
- Onde estão as divergências?
- O que precisa da minha atenção agora?

---

## 6. Estrutura visual sugerida

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Sidebar │ Visão Operacional                 Atualizado há 12 segundos │
│         │ [Empresa] [Unidade] [Operação] [Período] [Comparar]        │
├─────────┼────────────────────────────────────────────────────────────┤
│         │ Resumo inteligente da operação                    [Abrir IA]│
├─────────┼────────────────────────────────────────────────────────────┤
│         │ Progresso │ Conformidade │ Divergências │ Cobertura        │
│         │ Operações ativas          │ Frota disponível               │
├─────────┼────────────────────────────────────────────────────────────┤
│         │ Operação em andamento             │ Exceções prioritárias  │
│         │ progresso, drone, setor, ritmo    │ impacto e ações        │
├─────────┼────────────────────────────────────────────────────────────┤
│         │ Evolução da operação               │ Cobertura por setor    │
├─────────┼────────────────────────────────────────────────────────────┤
│         │ Leituras recentes                  │ Saúde da frota         │
└─────────┴────────────────────────────────────────────────────────────┘
```

---

## 7. Funcionalidades de cada área

### 7.1 Sidebar

Itens sugeridos:

- Visão Operacional;
- Operações;
- Inventário;
- Leituras;
- Divergências;
- Alertas;
- Frota;
- Empresas;
- Pessoas e acessos;
- Relatórios;
- Integrações;
- Configurações.

Comportamentos:

- recolhível;
- estado ativo claro;
- contador somente em itens que exigem atenção;
- favoritos;
- opções diferentes conforme a permissão;
- tooltip quando recolhida;
- comando de busca;
- botão de ajuda;
- perfil e logout no rodapé.

No tablet, a sidebar deve ficar recolhida. No celular, deve virar um menu sobreposto.

### 7.2 Cabeçalho

Elementos:

- título;
- empresa ou unidade atual;
- horário e fuso;
- status do sistema;
- horário da última atualização;
- botão atualizar;
- notificações;
- acesso ao assistente de IA;
- ações rápidas.

Ações rápidas possíveis:

- iniciar operação;
- registrar leitura manual;
- importar inventário planejado;
- gerar relatório;
- abrir divergência.

O botão principal deve variar conforme o perfil. Um operador pode ver “Iniciar operação”; um gestor pode ver “Revisar divergências”.

### 7.3 Barra global de filtros

Filtros:

- empresa;
- unidade ou armazém;
- operação;
- setor;
- drone;
- operador;
- período;
- turno;
- origem da leitura;
- status.

Comportamentos:

- filtros em cascata;
- todas as áreas respondem ao mesmo filtro;
- filtros ativos aparecem como chips;
- opção “Limpar tudo”;
- salvar uma visualização;
- compartilhar link com os filtros;
- lembrar a última visualização do usuário;
- comparação com período anterior ou meta;
- informar quando um filtro não possui resultados.

Os filtros devem ser refletidos na URL, permitindo atualização, favoritos e compartilhamento sem perder o contexto.

### 7.4 Resumo inteligente

Deve ser uma faixa compacta, não um chatbot gigante.

Exemplo:

> A operação Inventário Agosto está 68% concluída. Foram encontradas 14 divergências, sendo três críticas. O corredor C apresenta o maior atraso e o drone DJI-MV3-001 está com 28% de bateria.

Ações:

- ver evidências;
- explicar divergências;
- gerar plano de ação;
- dispensar;
- feedback positivo ou negativo.

O resumo só deve aparecer quando houver informação útil. Não deve ocupar espaço com mensagens genéricas.

### 7.5 Indicadores principais

Máximo recomendado: seis cards.

#### 7.5.1 Progresso da operação

- percentual concluído;
- posições concluídas e planejadas;
- estimativa de término;
- comparação com a meta;
- clique abre a operação.

#### 7.5.2 Conformidade do inventário

- percentual de itens sem divergência;
- variação comparada ao último inventário;
- quantidade de itens auditados;
- tooltip explicando a fórmula.

Não usar “acuracidade” até a fórmula oficial do negócio estar definida.

#### 7.5.3 Divergências abertas

- total;
- críticas;
- novas nas últimas horas;
- quantidade vencida no SLA;
- clique abre a lista filtrada.

#### 7.5.4 Cobertura física

- posições auditadas;
- total planejado;
- setores ainda não iniciados;
- clique abre a visão por setor ou mapa.

#### 7.5.5 Operações ativas

- operações em andamento;
- atrasadas;
- pausadas;
- clique abre o centro de operações.

#### 7.5.6 Frota pronta

- drones disponíveis e total;
- bateria média;
- drones em manutenção;
- drones sem comunicação.

Todo card precisa possuir:

- nome;
- valor;
- unidade;
- contexto;
- tendência;
- meta;
- definição;
- horário do dado;
- ação de drill-down.

### 7.6 Operação em andamento

Este deve ser o principal painel da página.

Informações:

- título da operação;
- empresa;
- unidade;
- setor atual;
- operador;
- drone;
- horário de início;
- duração;
- status;
- progresso;
- ritmo de leitura;
- estimativa de conclusão;
- última leitura;
- bateria;
- sinal;
- estado do scanner;
- leituras válidas, inválidas e duplicadas.

Ações conforme a permissão:

- abrir operação;
- pausar;
- retomar;
- encerrar;
- trocar setor;
- trocar drone;
- registrar ocorrência.

Pausar e encerrar exigem confirmação e motivo quando necessário.

Se não houver operação ativa, o painel deve mostrar:

- próxima operação agendada;
- botão para iniciar;
- instrução de preparação;
- status da frota disponível.

### 7.7 Exceções prioritárias

Mostrar somente as cinco situações mais importantes.

Cada item precisa ter:

- severidade;
- título;
- descrição curta;
- entidade afetada;
- impacto;
- tempo em aberto;
- responsável;
- SLA;
- ação principal.

Exemplos:

- produto encontrado em posição incorreta;
- quantidade diferente da esperada;
- QR inválido;
- leitura duplicada;
- setor não coberto;
- drone com bateria crítica;
- scanner sem comunicação;
- operação atrasada;
- produto frágil em local inadequado.

Ações:

- investigar;
- atribuir;
- reconhecer;
- resolver;
- abrir todos.

### 7.8 Evolução da operação

Gráfico temporal com:

- leituras válidas;
- leituras inválidas;
- ritmo planejado;
- ritmo realizado;
- divergências;
- meta acumulada.

Interações:

- selecionar intervalo;
- zoom;
- tooltip completo;
- ocultar séries;
- clicar em um ponto e abrir as leituras daquele momento;
- anotações de início, pausa, troca de drone e falhas.

Evitar muitos gráficos pequenos. Cada gráfico deve responder uma pergunta concreta.

### 7.9 Cobertura por setor

Inicialmente, pode ser uma lista hierárquica contendo:

- setor;
- posições planejadas;
- posições auditadas;
- progresso;
- divergências;
- última atividade;
- responsável.

Posteriormente, essa área pode se transformar em um mapa visual do armazém.

Estados semânticos:

- não iniciado;
- em andamento;
- concluído;
- concluído com divergências;
- bloqueado.

A cor não deve ser o único identificador; usar texto e ícone.

### 7.10 Leituras recentes

Cada leitura deve exibir:

- produto;
- identificador;
- quantidade;
- empresa;
- setor e posição;
- operador;
- drone;
- origem;
- horário;
- status;
- fragilidade;
- possível duplicidade;
- confiança da leitura.

Ao selecionar uma leitura, abrir um painel lateral com:

- QR bruto;
- dados interpretados;
- imagem ou evidência;
- operação;
- histórico de alterações;
- validações;
- erros;
- ação para corrigir;
- ação para marcar como divergência.

### 7.11 Saúde da frota

Para cada drone:

- modelo e serial;
- status;
- bateria;
- sinal;
- última comunicação;
- operação atual;
- horas de voo;
- manutenção prevista;
- ocorrências abertas.

`Disponível` não significa necessariamente `pronto`. Um drone só deve ser considerado pronto quando bateria, comunicação, manutenção e scanner estiverem adequados.

### 7.12 Rodapé operacional

Informações discretas:

- origem dos dados;
- última sincronização;
- versão do sistema;
- integridade das integrações;
- fuso horário;
- link para auditoria;
- ajuda e suporte.

---

## 8. Assistente de IA

O assistente pode ser aberto em um painel lateral, mantendo a dashboard visível.

### 8.1 Capacidades

- resumir a operação atual;
- responder perguntas sobre os dados;
- explicar indicadores;
- investigar divergências;
- apontar anomalias;
- recomendar próximos passos;
- criar resumo executivo;
- preparar relatório;
- sugerir filtros;
- localizar leituras específicas.

### 8.2 Exemplos de perguntas

- “O que exige atenção agora?”
- “Por que aumentaram as divergências?”
- “Qual setor está mais atrasado?”
- “Quais produtos frágeis foram encontrados em local incorreto?”
- “Compare esta operação com a anterior.”
- “Qual drone apresentou mais interrupções?”
- “Gere um resumo para o gestor.”

### 8.3 Requisitos de confiança

Cada resposta da IA deve apresentar:

- escopo analisado;
- período;
- horário da última atualização;
- fontes e registros relacionados;
- explicação da conclusão;
- nível de confiança;
- indicação de incerteza;
- opção de feedback;
- botão para verificar os dados.

### 8.4 Limites

- não modificar dados sem confirmação;
- não encerrar operações automaticamente;
- não resolver alertas silenciosamente;
- não esconder incerteza;
- não apresentar uma recomendação como fato;
- registrar ações sugeridas ou executadas em auditoria.

---

## 9. Estados obrigatórios no design

Cada componente precisa ser desenhado nos seguintes estados:

- carregando;
- carregado;
- vazio;
- sem resultado para os filtros;
- erro recuperável;
- indisponível;
- dados parciais;
- dados desatualizados;
- sem permissão;
- conexão perdida;
- IA indisponível;
- operação encerrada;
- confirmação;
- sucesso;
- ação crítica.

O carregamento deve usar skeletons com o mesmo tamanho do conteúdo final, evitando mudança de layout.

---

## 10. Responsividade

### 10.1 Desktop grande

- sidebar aberta;
- grid de 12 colunas;
- seis KPIs na mesma linha;
- operação e alertas lado a lado.

### 10.2 Notebook

- sidebar recolhível;
- KPIs em três colunas;
- filtros parcialmente compactados;
- painéis principais ainda lado a lado.

### 10.3 Tablet

- sidebar recolhida;
- KPIs em duas colunas;
- operação e alertas empilhados;
- filtros em drawer;
- ações principais sempre acessíveis.

### 10.4 Celular

O celular deve funcionar como acompanhamento operacional, não como uma versão espremida do desktop.

Prioridades:

- status;
- alertas;
- operação atual;
- última leitura;
- bateria;
- ações urgentes.

Tabelas devem virar cards. Não deve existir rolagem horizontal obrigatória.

---

## 11. Direção visual

O visual atual possui personalidade, mas para parecer mais corporativo é recomendado:

- manter o tema tecnológico escuro;
- reduzir brilhos excessivos em áreas densas;
- reservar gradientes para pontos de destaque;
- aumentar o contraste de textos secundários;
- diminuir títulos muito grandes dentro do painel;
- criar densidade confortável para uso diário;
- utilizar uma escala fixa de espaçamento;
- padronizar raio, sombra, borda e elevação;
- manter cores semânticas consistentes;
- adicionar modo claro ou alto contraste;
- tornar a sidebar menos dominante;
- priorizar dados e ações, não decoração.

A identidade Gestock deve continuar aparecendo no ciano, no scanner, na marca e nos detalhes. O dado operacional, porém, deve ser o protagonista.

### 11.1 Sistema visual sugerido

- grid principal de 12 colunas;
- escala de espaçamento baseada em 4 ou 8 pixels;
- altura consistente para cards equivalentes;
- tipografia com hierarquia clara;
- bordas discretas;
- sombras somente para indicar elevação;
- animações curtas e funcionais;
- ícones acompanhados de rótulos em ações importantes;
- vermelho reservado a criticidade;
- verde reservado a sucesso ou operação saudável;
- amarelo ou âmbar reservado a atenção;
- ciano como cor principal da marca e seleção.

---

## 12. Acessibilidade

A meta deve ser **WCAG 2.2 nível AA**.

Requisitos:

- navegação completa por teclado;
- foco visível;
- contraste adequado;
- rótulos claros;
- tamanho confortável para cliques;
- nenhuma informação transmitida somente por cor;
- suporte à redução de movimento;
- gráficos com alternativa textual;
- autenticação acessível;
- ordem lógica de foco;
- mensagens de erro associadas aos campos;
- tooltips acessíveis por teclado;
- textos redimensionáveis;
- conteúdo compreensível sem animações.

Fonte: [Web Content Accessibility Guidelines 2.2 — W3C](https://www.w3.org/TR/WCAG22/)

---

## 13. Desempenho

Metas recomendadas:

- LCP até 2,5 segundos;
- INP até 200 milissegundos;
- CLS até 0,1;
- atualização sem travar a interface;
- ausência de reposicionamento inesperado dos cards;
- carregamento progressivo;
- consultas consolidadas;
- renderização eficiente dos gráficos;
- paginação ou virtualização de listas grandes;
- cancelamento de consultas obsoletas.

Fonte: [Core Web Vitals thresholds — web.dev](https://web.dev/articles/defining-core-web-vitals-thresholds)

---

## 14. Critérios para considerar a página pronta

Antes da implementação, o design precisa passar nestes testes:

- um gestor identifica o principal problema em até dez segundos;
- um operador encontra a ação de iniciar leitura sem treinamento;
- todo indicador principal possui um destino de drill-down;
- todo alerta possui uma ação possível;
- todo número possui definição e período;
- é possível saber quando os dados foram atualizados;
- a página continua compreensível sem as cores;
- a página funciona com teclado;
- o celular não possui tabelas espremidas;
- nenhum estado vazio parece erro;
- a IA sempre mostra contexto e evidências;
- uma ação destrutiva nunca ocorre sem confirmação;
- administrador e operador não veem informações ou ações indevidas;
- filtros permanecem ao atualizar ou compartilhar a página;
- dados desatualizados são claramente identificados;
- o layout suporta textos longos, números grandes e ausência de dados.

---

## 15. Ordem correta antes de mexer no código

1. Definir usuários e decisões que a dashboard precisa suportar.
2. Criar o dicionário oficial de métricas.
3. Definir o inventário planejado e a fórmula de divergência.
4. Desenhar o wireframe desktop em baixa fidelidade.
5. Desenhar todos os estados dos componentes.
6. Adaptar o wireframe para tablet e celular.
7. Criar o design system Gestock.
8. Montar um protótipo navegável.
9. Testar com pelo menos um gestor e operadores.
10. Refinar o design.
11. Somente então alterar banco, API e frontend.

---

## 16. Decisão central do produto

A nova dashboard deve ser uma:

> **Central operacional orientada a exceções, decisões e ações.**

Ela não deve ser apenas uma página bonita com métricas. Cada informação precisa ajudar o usuário a entender a operação, localizar um problema ou executar uma ação.

O próximo passo de produto é transformar esta especificação em:

1. arquitetura da informação;
2. wireframe desktop;
3. wireframe responsivo;
4. design system;
5. protótipo navegável;
6. validação com usuários;
7. plano técnico de implementação.
