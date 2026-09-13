# Gestock Drone Agent

Agente local que conversa com o drone, processa o vídeo **na borda** e
(mais tarde) sincroniza só os resultados com a nuvem.

> **Marco atual: 1 de 5 — conexão e vídeo.**
> Faz: conectar → receber frames → monitorar → reconectar sozinho.
> Ainda não faz: QR, SQLite, API, WebSocket. É proposital — stream
> instável estraga qualquer coisa construída em cima.

---

## Por que este programa existe separado do servidor

O drone cria a própria rede Wi-Fi e atende em `192.168.1.1`. Esse é um
IP **privado**: um servidor na nuvem não tem como rotear até ele, nunca.
Quem fala com o drone precisa estar na mesma rede — daí o Agent rodar na
máquina do operador.

De quebra, processar localmente evita jogar vídeo inteiro para a nuvem:
menos banda, menos latência, menos custo, e funciona sem internet.

---

## Instalação

```bash
cd gestock-drone-agent
python -m venv .venv

# Linux / macOS
source .venv/bin/activate
# Windows
.venv\Scripts\activate

pip install -r requirements.txt
```

Requer Python 3.10+. O `opencv-python` já traz o FFmpeg que fala RTSP —
não precisa instalar FFmpeg à parte para o Agent funcionar.

---

## Rodando com o drone FLOW-UFO

1. Conecte o notebook na Wi-Fi do drone (`FLOW-UFO_xxxxxx`).
2. Rode:

```bash
python -m src.main --driver flow-ufo
```

Abre uma janela com o vídeo. `ESC` encerra.

Sem janela (só métricas no terminal):

```bash
python -m src.main --driver flow-ufo --headless
```

### Se der erro

O Agent sonda a porta `7070` antes de tentar abrir o vídeo, então a
falha é rápida e a mensagem é específica:

```
Porta 192.168.1.1:7070 não respondeu.
O notebook está conectado na rede Wi-Fi do drone (FLOW-UFO*)?
```

Quase sempre é isso: o notebook voltou para a Wi-Fi de casa sozinho.

> **Por que sondar a porta?** `192.168.1.1` é o IP de roteador doméstico
> mais comum do mundo. Responder `ping` não prova que é o drone — a
> porta 7070 aberta é evidência bem melhor.

---

## Rodando **sem** o drone

Dá para desenvolver e testar o Agent inteiro sem o equipamento na mesa:

```bash
# imagem gerada em memória, com QR de verdade (não precisa de câmera)
python -m src.main --driver synthetic

# webcam do notebook
python -m src.main --driver usb

# vídeo gravado — este é o Plano B da apresentação
python -m src.main --driver file --source voo.mp4

# qualquer outra câmera RTSP
python -m src.main --driver rtsp --source rtsp://192.168.1.1:7070/webcam
```

Para o resto do sistema, essas fontes são indistinguíveis do drone ao
vivo — é o ponto da abstração de driver.

---

## Testes

Rodam em qualquer máquina, sem drone e sem câmera:

```bash
python tests/test_engine.py
```

Provam que o engine entrega frames, **sempre entrega o mais recente**,
reconecta sozinho quando a fonte cai, e sinaliza `ERRO` quando ela não
volta.

---

## Opções

| Flag | Padrão | Para quê |
|------|--------|----------|
| `--driver` | `flow-ufo` | `flow-ufo`, `rtsp`, `usb`, `file`, `synthetic` |
| `--source` | — | URL, arquivo ou índice da webcam |
| `--ip` / `--port` / `--path` | `192.168.1.1` / `7070` / `/webcam` | endereço do drone |
| `--transport` | `tcp` | `tcp` ou `udp` (TCP costuma ser mais estável em Wi-Fi) |
| `--stall-timeout` | `5` | segundos sem frame válido até reconectar |
| `--max-reconnects` | `0` | `0` = tenta para sempre |
| `--headless` | — | não abre janela |
| `--duration` | `0` | encerra após N segundos (útil em teste) |

---

## Como está organizado

```
src/
├── main.py                 CLI e laço principal
├── core/states.py          máquina de estados
├── drivers/
│   ├── base.py             ← o contrato. A peça central.
│   ├── flow_ufo.py         drone FLOW-UFO
│   ├── rtsp_generic.py     qualquer RTSP
│   └── local_sources.py    webcam, arquivo, sintético
└── video/engine.py         mantém o stream vivo e no presente
```

**A regra que sustenta tudo:** nada acima de `drivers/` sabe qual
equipamento está conectado. Trocar de drone = escrever um arquivo novo
em `drivers/` e registrá-lo no `__init__.py`. O QR Engine, o banco e o
frontend não mudam.

### Os dois problemas que o VideoEngine resolve

**Latência acumulada.** O FFmpeg do OpenCV enfileira frames. Consumidor
mais lento que o stream = você lê o frame N enquanto o drone já está no
N+30, ou seja, lê o passado. Uma thread lê o mais rápido possível e
guarda **apenas o último frame**; o resto é descartado. Medido nos
testes: `atraso = 0 frames`.

**Queda de conexão.** Frame perdido é rotina em Wi-Fi e não é tratado
como erro. O que dispara reconexão é ficar `--stall-timeout` segundos
sem nenhum frame **bom**. A reconexão usa backoff exponencial (1s, 2s,
4s… até 15s) para não martelar o equipamento.

---

## Estados

```
OFFLINE → PROCURANDO_DRONE → CONECTANDO_STREAM → STREAM_ATIVO
                                                      ↓
                                               LEITURA_ATIVA (marco 2)
em falha:
STREAM_ATIVO → CONEXAO_PERDIDA → RECONECTANDO → STREAM_ATIVO
                                      ↓ (esgotou as tentativas)
                                    ERRO
```

---

## Próximos marcos

| # | O quê | Situação |
|---|-------|----------|
| 1 | Conexão, vídeo, reconexão | ✅ feito |
| 2 | QR Engine + deduplicação | a fazer |
| 3 | SQLite local + fila offline | a fazer |
| 4 | CloudClient (HTTP → depois WebSocket) | a fazer |
| 5 | Empacotar `.exe` para Windows | a fazer |

### Atenção no marco 4

Quando o notebook está na Wi-Fi do drone, ele **não tem internet**. Isso
significa que a nuvem não consegue mandar comando para o Agent. Portanto
o Agent precisa de **controle local** (iniciar/parar sem depender da
nuvem); comandos vindos da nuvem são um caminho adicional, nunca o único.

Para a apresentação, a saída prática é um **adaptador Wi-Fi USB** ou
tethering USB do celular: aí dá para ter drone e internet ao mesmo tempo
e o dashboard atualiza ao vivo.
