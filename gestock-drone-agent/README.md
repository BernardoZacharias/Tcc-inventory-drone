# Gestock Drone Agent

Agente local que conversa com o drone, processa o vídeo **na borda** e
(mais tarde) sincroniza só os resultados com a nuvem.

> **Marco atual: 2 de 5 — conexão, vídeo e leitura de QR.**
> Faz: conectar → receber frames → monitorar → reconectar sozinho →
> ler QR Codes com confirmação e sem repetição.
> Ainda não faz: SQLite, API, WebSocket. As leituras saem no terminal.
> É proposital — gravar leitura errada é pior que não gravar nada.

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

## Quando der problema: rode o diagnóstico primeiro

```bash
python -m src.doctor
```

Ele testa **uma camada de cada vez** — Python, numpy, OpenCV, ffmpeg,
rede, porta do drone, stream — e diz exatamente onde parou, em vez de
"não funciona". O teste do OpenCV roda num subprocesso isolado, então
mesmo que o OpenCV mate o processo o diagnóstico sobrevive e te conta.

### `illegal hardware instruction (core dumped)`

Sintoma: o Agent loga `Porta 192.168.1.1:7070 aberta — Abrindo vídeo...`
e o processo morre na hora, sem erro de Python.

Causa: o wheel do **opencv-python 5.0.x** usa instruções de CPU que a
sua máquina não tem. Morre com SIGILL dentro do binário nativo — não é
exceção Python, é o processo inteiro caindo.

**Solução 1 — voltar para o OpenCV 4.x (recomendada):**

```bash
pip install "opencv-python>=4.9,<5"
```

O `requirements.txt` já trava nessa faixa; quem instalou antes da
correção precisa rodar o comando acima.

**Solução 2 — usar o ffmpeg do sistema (não passa pelo OpenCV):**

```bash
python -m src.main --driver flow-ufo --backend ffmpeg --headless
```

Esse caminho pede frames ao binário `ffmpeg` — o mesmo que você já
validou com o `ffplay` — e só remonta os bytes com numpy. Fica imune a
qualquer problema do OpenCV. Precisa de `ffmpeg` instalado:

```bash
sudo pacman -S ffmpeg      # Arch
sudo apt install ffmpeg    # Ubuntu/Debian
```

> Sem `ffprobe` o Agent não descobre a resolução sozinho. Nesse caso
> passe na mão: `--width 1280 --height 720`.

### O vídeo trava depois de alguns segundos

Tente o outro transporte — alguns firmwares implementam RTSP de forma
peculiar:

```bash
python -m src.main --driver flow-ufo --transport udp
```

### `Porta 192.168.1.1:7070 não respondeu`

O notebook saiu da Wi-Fi do drone (costuma voltar sozinho para a rede
de casa). Reconecte na `FLOW-UFO_*` e tente de novo.

---

## Leitura de QR (marco 2)

```bash
# com o drone
python -m src.main --driver flow-ufo --qr

# sem drone nenhum, para ver funcionando
python -m src.main --driver synthetic --qr --headless --duration 10
```

Cada leitura confirmada aparece assim:

```
[QR CLAHE] Teclado Logitech | 50 un | Corredor A - Prateleira 3
```

E o rodapé de status ganha três números:

```
lidos=12   repetidos=430   analisados=641
```

`repetidos` alto é **sinal de saúde**, não de problema: quer dizer que a
mesma etiqueta ficou no enquadramento e o motor não a contou duas vezes.

### As duas regras que fazem a leitura ser confiável

**1. Confirmação em múltiplos quadros.** Um código só vale depois de
aparecer em 2 dos últimos 4 quadros. Decodificação isolada erra: um
reflexo na etiqueta, o borrão do drone se movendo ou meio QR entrando no
enquadramento produzem leitura fantasma. Esperar a repetição custa
décimos de segundo e elimina isso. Ajuste com `--qr-confirmacoes`.

**2. Deduplicação por sessão.** Cada código é contado **uma vez**. O
código antigo guardava apenas o último QR lido — lendo A, depois B,
depois A de novo, o segundo A era reenviado e o inventário dobrava. Aqui
as repetições viram contador.

### A armadilha do acento

A norma do QR Code manda interpretar o modo byte como **Shift-JIS**
quando o código não traz o marcador ECI. O zbar obedece à letra. Como
nossos QR trazem `Frágil: Não` em UTF-8 sem ECI, o texto voltava como
katakana japonês.

O motor desfaz isso (`texto_do_qr`), e há teste fixando o comportamento.
Se um dia alguém trocar o gerador de QR, esse teste avisa.

---

## Mostrando o vídeo no aplicativo

O Agent pode publicar o que está vendo num servidor HTTP local, que é
como o aplicativo desenha a tela de voo:

```bash
python -m src.main --driver flow-ufo --qr --servidor
```

| Rota | O que devolve |
|------|---------------|
| `/video` | o vídeo, em MJPEG (`multipart/x-mixed-replace`) |
| `/estado` | JSON com estado, métricas e leituras da sessão |
| `/leituras` | JSON só com as leituras |
| `/` | uma página mínima para conferir fora do aplicativo |

Abra `http://127.0.0.1:8765/` no navegador e você vê o vídeo sem
precisar do Electron.

### Por que MJPEG

A tela é React dentro do Electron. Passar quadro a quadro por IPC seria
caro e ainda exigiria converter tudo para base64. Com MJPEG o React
mostra o vídeo com uma `<img>` comum, e o navegador decodifica sozinho:
sem codec, sem player, sem IPC de vídeo. A latência é de um quadro.

### Duas decisões que não são detalhe

**Escuta só em `127.0.0.1`.** Em `0.0.0.0`, qualquer um no mesmo Wi-Fi
assistiria ao vídeo do estoque. Há teste fixando isso.

**O JPEG é gerado sob demanda**, na thread de quem está assistindo. Sem
ninguém olhando, não se gasta CPU comprimindo quadro que ninguém vê — e
o laço que lê os QR nunca espera pelo vídeo.

### Porta

O padrão é `8765`. Se estiver ocupada, o Agent anda para a seguinte e
anuncia a escolhida numa linha do stdout:

```
GESTOCK_SERVIDOR porta=8766
```

É assim que o aplicativo descobre onde buscar o vídeo — combinar um
número fixo faria abrir o app duas vezes virar um conflito.

---

## Por que a leitura é rápida

Medido nesta máquina, com um quadro 960x540 de corredor de galpão:

| | antes | agora |
|---|---|---|
| quadro **sem** código (a maior parte do voo) | 486 ms | **64 ms** |
| quadro **com** código | 46 ms | **18 ms** |

O gasto real nunca foi filtrar a imagem — é **chamar o decodificador**.
Cada tentativa custa muito mais que um threshold. As três otimizações
atacam o número de tentativas, não o número de filtros.

**1. Procurar só QR.** Por padrão o zbar varre atrás de tudo que
conhece — EAN, UPC, CODE 39, CODE 128, ITF, PDF417, DataBar — passando
cada decodificador por cada linha da imagem. Nosso sistema só usa QR:
restringir deixou a decodificação **4 a 5 vezes mais rápida**. De
quebra, calou a enxurrada de `Assertion failed` que o decodificador de
PDF417 cuspia no log ao encontrar ruído.

**2. Começar pelo tratamento que funcionou.** A iluminação de um galpão
não muda a cada quadro: a variante que leu a etiqueta anterior quase
sempre lê a próxima. Isso troca até 6 tentativas por 1 — e é o ganho no
momento que importa, quando há um código na frente da câmera.

**3. Varredura rotativa quando não há nada.** O quadro vazio é o mais
comum e era o mais caro, porque percorria as seis variantes só para
concluir que não havia nada. Agora cada quadro experimenta duas e o
seguinte continua de onde parou; em três quadros cobre tudo. Como a
aceitação já exige confirmação em múltiplos quadros, não se perde
qualidade — só custo.

O rodapé do Agent mostra quanto está custando de verdade:

```
Custo: 1.00 tentativas e 7.8 ms por quadro
  CINZA     69 acerto(s) em 69 tentativa(s), 7.8 ms cada
```

`tentativas por quadro` perto de 1 significa que o leitor acertou a
aposta. Muito acima disso, vale olhar qual variante está ganhando e
considerar `--qr-varredura 1`.

---

## Testes

Rodam em qualquer máquina, sem drone e sem câmera:

```bash
python tests/test_engine.py     # marco 1 — vídeo
python tests/test_qr.py         # marco 2 — leitura
python tests/test_servidor.py   # a ponte com o aplicativo
```

O primeiro prova que o engine entrega frames, **sempre entrega o mais
recente**, reconecta sozinho quando a fonte cai e sinaliza `ERRO` quando
ela não volta.

O segundo prova que um código **não** é aceito com uma aparição só, que
o mesmo código conta **uma vez por sessão**, e que um QR de verdade —
renderizado numa imagem de verdade, inclusive escura e borrada — é lido.
Esse último importa: sem ele, os testes passariam numa máquina onde a
decodificação está quebrada.

---

## Opções

| Flag | Padrão | Para quê |
|------|--------|----------|
| `--driver` | `flow-ufo` | `flow-ufo`, `rtsp`, `usb`, `file`, `synthetic` |
| `--source` | — | URL, arquivo ou índice da webcam |
| `--ip` / `--port` / `--path` | `192.168.1.1` / `7070` / `/webcam` | endereço do drone |
| `--transport` | `auto` | `auto`, `tcp` ou `udp`. **Não mude sem precisar**: o FLOW-UFO responde `461 Unsupported Transport` quando o transporte é imposto |
| `--backend` | `opencv` | `ffmpeg` decodifica pelo ffmpeg do sistema, quando o OpenCV quebra |
| `--qr` | — | liga a leitura de QR Codes |
| `--qr-confirmacoes` | `2` | quantos quadros precisam ver o mesmo código |
| `--qr-janela` | `4` | em quantos quadros recentes procurar as confirmações |
| `--qr-fps` | `12` | quantos quadros por segundo analisar |
| `--qr-upscale` | `1.0` | amplia antes de decodificar (use `2` para etiqueta pequena/longe) |
| `--qr-recorte` | `0` | ignora as bordas (ex.: `0.15` foca no centro) |
| `--qr-varredura` | `2` | quantos tratamentos experimentar por quadro enquanto não há código à vista. `0` = todos (exaustivo e bem mais lento) |
| `--qr-intervalo-cv2` | `5` | de quantos em quantos quadros sem achado tentar também o detector do OpenCV |
| `--qr-vista` | — | publica também a imagem tratada: `CINZA`, `CLAHE`, `SHARP`, `OTSU`, `ADAPT`, `OTSU_INV` |
| `--servidor` | — | publica vídeo e estado em `127.0.0.1` para o aplicativo |
| `--porta` | `8765` | porta do servidor local; anda para a seguinte se ocupada |
| `--video-fps` | `15` | quadros por segundo enviados para a tela |
| `--video-qualidade` | `80` | qualidade do JPEG, de 1 a 100 |
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
| 2 | QR Engine + deduplicação | ✅ feito |
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
