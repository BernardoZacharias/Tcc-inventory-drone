# Gestock Drone — aplicativo

Junta as três partes do projeto num executável só. O operador abre um
ícone: não existe terminal, `npm run dev`, nem saber que há um servidor
e um Python rodando por baixo.

```
GestockDrone.exe
│
├── processo principal (Node)
│   ├── API Express        ← o api-node, rodando DENTRO do Electron
│   └── Agent Python       ← iniciado sob demanda (sidecar)
│
├── janela (Chromium)
│   └── React              ← o frontend, sem alterações
│
└── dados
    ├── Supabase           ← hoje
    └── SQLite local       ← marco 3 (funciona sem internet)
```

## Por que Electron

O processo principal do Electron **é** Node. Como o `api-node` não usa
nenhum módulo nativo (`bcryptjs` e `pg` são JavaScript puro), ele roda
aqui dentro sem recompilar nada e sem processo separado.

Tauri geraria um instalador bem menor (~10 MB contra ~150 MB), mas
exigiria Rust — um quarto idioma num projeto que já tem React, Node e
Python — e a API Express teria que virar processo à parte de qualquer
forma.

## Rodando

Pré-requisitos: Node 20+, e Python 3.10+ se for usar o drone.

```bash
cd desktop
npm install
npm run build:frontend    # gera frontend/dist com caminhos relativos
npm start
```

Antes de abrir a janela, confira se está tudo no lugar:

```bash
npm run smoke
```

Ele valida sem abrir janela: componentes no disco, Python encontrado,
API subindo dentro do Electron e o banco respondendo.

### Desenvolvendo

Para editar o React com recarga automática, deixe o Vite rodando e
aponte o app para ele:

```bash
npm --prefix ../frontend run dev     # terminal 1
npm run dev                          # terminal 2 (usa localhost:5173)
```

## A tela de voo

Clicar em **Iniciar leitura** no painel sobe o Agent do drone e abre a
tela de voo: a câmera do drone em tela cheia, métricas no topo e as
leituras entrando à direita.

O vídeo não passa por IPC. O Agent publica MJPEG num servidor que só
escuta em `127.0.0.1`, e o React mostra com uma `<img>` comum — o
navegador decodifica sozinho, sem codec e sem player. O Agent anuncia a
porta escolhida numa linha do stdout (`GESTOCK_SERVIDOR porta=8765`), e
é assim que o app descobre onde buscar; combinar um número fixo faria
abrir o aplicativo duas vezes virar um conflito.

**O decodificador é escolhido na hora**, e não no chute, porque as duas
máquinas do projeto precisam de respostas opostas: no Windows o OpenCV
funciona e o ffmpeg costuma não estar no PATH; no Arch os binários do
OpenCV morrem com SIGILL e só o ffmpeg resolve. O app pergunta num
subprocesso — tem que ser em subprocesso, porque SIGILL não é exceção
de Python, é o processo sendo morto pelo sistema.

Para conferir a cadeia inteira sem drone:

```bash
npm run smoke
```

---

## Gerando o instalador

```bash
npm run dist:win      # Windows  -> dist-app/Gestock Drone Setup.exe
npm run dist:linux    # Linux    -> dist-app/*.AppImage
```

O instalador leva junto `frontend/dist`, `api-node` e
`gestock-drone-agent` (sem `.venv` e sem `__pycache__`).

> **Python não vai embutido.** O `.venv` do Agent fica de fora porque é
> específico da máquina. Em produção de verdade isso se resolve
> empacotando o Agent com PyInstaller — é o marco 5.

## Como o React fala com o app

A janela roda com `contextIsolation` e **sem** `nodeIntegration`: o React
não enxerga `require`, `fs` nem `process`. A única ponte é o
`preload.js`, que expõe exatamente isto:

```js
window.gestock.desktop            // true quando roda dentro do app
await window.gestock.info()       // versão, plataforma, URL da API, Python
await window.gestock.agente.iniciar({ driver: "flow-ufo", backend: "ffmpeg" })
await window.gestock.agente.parar()
await window.gestock.agente.estado()   // { rodando, erro, saida[] }
```

O mesmo React continua funcionando no navegador: basta checar
`window.gestock?.desktop` antes de usar.

## Duas armadilhas já resolvidas

**Caminho dos assets.** O Vite gera `/assets/...` por padrão. Sob
`file://`, essa barra inicial aponta para a raiz do disco e a janela abre
**em branco**, sem erro. Por isso o build do desktop usa
`GESTOCK_TARGET=desktop`, que liga `base: "./"` no `vite.config.js`. O
build da web segue com `/`, sem mudança para a Vercel.

**Porta ocupada.** Se você estiver com `npm run dev` do `api-node`
aberto, a 3000 está em uso. O app procura a próxima porta livre em vez
de falhar.

## Estrutura

```
desktop/
├── main.js              janela, ciclo de vida, ponte IPC
├── preload.js           a única superfície exposta ao React
├── src/
│   ├── paths.js         onde cada parte mora (dev x instalado)
│   ├── api-server.js    sobe o Express dentro do Electron
│   └── agente.js        acha o Python e controla o sidecar
└── scripts/smoke.js     teste sem abrir janela
```
