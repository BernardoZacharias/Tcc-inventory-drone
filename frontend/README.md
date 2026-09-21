# Frontend — Gestock Drone

React + Vite. Um único aplicativo serve a duas coisas bem diferentes, e
a pasta `src/` é organizada em torno dessa diferença.

## Estrutura

```
src/
  main.jsx          ponto de entrada
  App.jsx           casca: rota, tema, sessão, transição de tela

  landing/          o SITE — existe para explicar o produto
  dashboard/        o SISTEMA — existe para operar o produto
  shared/           o que os dois usam de verdade
```

Cada grupo repete as mesmas subpastas (`pages/`, `components/`,
`styles/`, `hooks/`, `utils/`, `assets/`), então o caminho de um arquivo
já diz a que mundo ele pertence.

## Onde colocar um arquivo novo

A pergunta não é "quem importa isso hoje", e sim **"isso some se o
outro lado sumir?"**

- Só faz sentido para quem está decidindo se usa o produto → `landing/`
- Só faz sentido para quem já está trabalhando → `dashboard/`
- Os dois lados precisariam reinventar se o outro sumisse → `shared/`

`shared/` é o grupo que deve crescer devagar. Ele guarda o que é
genuinamente comum — sessão, tema, chamadas à API, avisos — e não o que
por acaso tem dois usuários hoje. Um componente que os dois lados usam
por coincidência tende a virar dois componentes disfarçados de um, cheio
de condicionais sobre onde está sendo renderizado.

Alguns arquivos ficam em `landing/` embora seja o `App.jsx` quem os
monta: a navbar, o cursor-drone e a tela de abertura. O critério é
**onde aparecem**, não quem os instancia — nenhum dos três existe dentro
do aplicativo instalado.

## Transição de tela

A landing desliza na direção do clique; o painel não anima. Quem
trabalha troca de tela dezenas de vezes seguidas, e ali qualquer
animação vira espera repetida. A regra mora em
`shared/utils/transicao.js` e está sob teste em
`tests/transicao.test.mjs` — inverter um sinal ou reanimar o painel não
quebra nada visivelmente, só deixa a navegação estranha ou lenta, que é
o tipo de defeito que passa despercebido.

As telas internas do painel são carregadas sob demanda, mas os pacotes
são buscados antes do clique (`aquecerPainel`, no `App.jsx`), enquanto o
navegador está ocioso. Sem isso, a divisão do pacote trocava peso
inicial por tela em branco na navegação.

## Comandos

```bash
npm run dev      # servidor de desenvolvimento
npm run build    # gera dist/ (consumido também pelo app Electron)
npm run lint
npm test         # testes de nó, sem navegador
```

`qa/` é um harness separado que monta as telas do painel com dados
falsos, sem API nem sessão — serve para conferir aparência sem precisar
subir o back-end.
