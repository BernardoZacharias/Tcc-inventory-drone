# Como testar o Gestock Drone

Guia prático, do teste que não precisa de nada até o voo com o drone.

A ordem importa: cada nível elimina uma fonte de erro. Se você pular
direto para o drone e não funcionar, não vai saber se o problema é o
leitor, a rede, a câmera ou o banco.

| Nível | Precisa de | Prova o quê | Tempo |
|-------|-----------|-------------|-------|
| [1](#1-testes-automáticos) | nada | o código está íntegro | 10 s |
| [2](#2-leitor-de-qr-sem-câmera) | nada | o leitor de QR funciona | 10 s |
| [3](#3-leitor-de-qr-com-a-webcam) | webcam | a leitura funciona com câmera real | 2 min |
| [4](#4-sistema-completo-no-navegador) | Supabase | API + banco + painel | 5 min |
| [5](#5-o-aplicativo-instalável) | — | o app abre, lê o drone e mostra o vídeo | 3 min |
| [6](#6-o-drone-de-verdade) | drone FLOW-UFO | tudo junto | — |

---

## 1. Testes automáticos

Rodam em qualquer máquina, sem drone, sem câmera e sem internet.

```bash
cd gestock-drone-agent
.venv\Scripts\python tests\test_engine.py
.venv\Scripts\python tests\test_qr.py
.venv\Scripts\python tests\test_servidor.py
.venv\Scripts\python tests\test_fila.py
```

No Linux/macOS troque por `.venv/bin/python`.

Esperado: `todos os testes passaram` e `Todos passaram.`

O que eles provam:

- **`test_engine.py`** (9 testes) — o vídeo chega, **sempre o quadro mais
  recente** (latência não acumula), reconecta sozinho quando a fonte cai,
  e sinaliza `ERRO` quando ela não volta.
- **`test_qr.py`** (31 testes) — um código não é aceito com uma aparição
  só, o mesmo código conta uma vez por sessão, e um QR **de verdade** é
  lido, inclusive escuro e borrado.
- **`test_servidor.py`** (19 testes) — a ponte com o aplicativo: o vídeo
  escuta **só** em `127.0.0.1`, o MJPEG carrega JPEG de verdade, e uma
  porta ocupada não derruba o Agent.
- **`test_fila.py`** (10 testes) — a leitura não se perde: é gravada no
  disco antes de qualquer rede, sobrevive a ficar **sem internet** (o
  caso normal na Wi-Fi do drone), sobe sozinha e em ordem quando a rede
  volta, e nunca é descartada por falha de envio.

> O último é o que mais importa. Sem ele, os testes passariam numa
> máquina onde a decodificação está quebrada — foi exatamente esse buraco
> que deixou o Agent falhar no Arch depois de "todos os testes passarem".

E o painel web:

```bash
cd frontend
npm test
npm run lint
```

---

## 2. Leitor de QR sem câmera

A fonte sintética desenha um QR **real** em memória e o entrega ao
mesmo motor que recebe o vídeo do drone. É o teste mais rápido de
"o leitor está vivo?".

```bash
cd gestock-drone-agent
.venv\Scripts\python -m src.main --driver synthetic --qr --headless --duration 10
```

Esperado:

```
INFO  agent: [QR CINZA] Teclado Logitech | 50 un
[OK ] Lendo QR Codes   fps=25.0  recebidos=101 ...  |  lidos=1  repetidos=32  analisados=34
INFO  agent: Leitura: 1 código(s) único(s) em 42 quadros analisados (40 repetições ignoradas)
```

### Lendo os números

| Campo | O que significa |
|-------|-----------------|
| `fps` | quadros por segundo chegando do vídeo |
| `descartados` | quadros pulados de propósito para não acumular atraso — **normal** |
| `lidos` | códigos **únicos** confirmados nesta sessão |
| `repetidos` | releituras do mesmo código, ignoradas |
| `analisados` | quadros que passaram pelo leitor (limitado por `--qr-fps`) |

**`repetidos` alto é sinal de saúde.** Quer dizer que a etiqueta ficou no
enquadramento e o motor não a contou duas vezes. Era exatamente isso que
o código antigo errava.

**`lidos=0` com a fonte sintética é defeito.** Procure no início da saída
um aviso dizendo que o QR não pôde ser desenhado — normalmente é
dependência faltando (`pip install -r requirements.txt`).

---

## 3. Leitor de QR com a webcam

Este é o teste que convence: câmera de verdade, papel de verdade.

**Passo 1 — gere as etiquetas:**

```bash
cd gestock-drone-agent
.venv\Scripts\python scripts\gerar_qr.py
```

Saem 3 PNGs em `etiquetas/`, com o texto exato que a API espera. Imprima,
ou simplesmente abra no celular e use a tela.

**Passo 2 — aponte a webcam:**

```bash
.venv\Scripts\python -m src.main --driver usb --qr
```

Abre uma janela com o vídeo. Ponha a etiqueta na frente. `ESC` encerra.

**O que observar:**

- Passe a mesma etiqueta duas vezes: ela é contada **uma vez** e
  `repetidos` sobe.
- Mostre a etiqueta A, depois a B, depois a A de novo: só saem duas
  leituras. Esse é o caso que fazia o inventário dobrar antes.
- Afaste a etiqueta até parar de ler, depois tente `--qr-upscale 2`.

**Se não ler:**

| Sintoma | Tente |
|---------|-------|
| etiqueta pequena ou longe | `--qr-upscale 2` |
| ambiente escuro | aproxime; o pipeline já trata contraste |
| lê devagar | `--qr-fps 25` (usa mais CPU) |
| outra webcam | `--driver usb --source 1` |

---

## 4. Sistema completo no navegador

Precisa do `api-node/.env` preenchido com a senha do Supabase.

**Terminal 1:**

```bash
cd api-node
npm run db:test
npm run dev
```

`db:test` tem que dizer que conectou. Se falhar, o problema é a senha ou
a URL — resolva antes de seguir, porque nada mais vai funcionar.

**Terminal 2:**

```bash
cd frontend
npm run dev
```

Abra `http://localhost:5173` e entre com:

| E-mail | Senha | Perfil |
|--------|-------|--------|
| `admin@gestock.com.br` | `123456` | admin (vê todas as empresas) |
| `vanderlei@gestock.com.br` | `123456` | operador (vê só a dele) |

Confira: o Dashboard carrega números, Leituras lista registros, e o
seletor de tema claro/escuro funciona.

---

## 5. O aplicativo instalável

```bash
cd desktop
npm start
```

A tela de acesso faz uma **checagem pré-voo** e mostra quatro itens:

| Item | Verde quer dizer |
|------|------------------|
| Painel | a interface carregou |
| Serviço | a API respondeu |
| Banco de dados | o Supabase respondeu |
| Leitor do drone | achou um Python para rodar o Agent |

Se "Leitor do drone" ficar amarelo, o Python não foi encontrado — rode o
script de instalação, que cria o `.venv` no lugar onde o app procura.

### A tela de voo

Cada leitura é **gravada no computador na hora**, antes de qualquer
tentativa de rede, e sobe para o estoque quando houver internet. O
rodapé do painel de leituras diz onde elas estão:

- verde — *"N leituras registradas no estoque"*
- âmbar — *"N leituras salvas no computador, aguardando internet"*

Na Wi-Fi do drone **não há internet**, então ficar em âmbar durante o
voo é o esperado, não um erro. Ao sair para uma rede com internet, a
fila esvazia sozinha e os itens aparecem no Dashboard.

Ao ler um código, a tela **apita e mostra "QR Code lido"** com o nome do
produto, e a moldura dá um clarão verde. O operador está olhando para a
prateleira, não para o monitor — por isso o som vem primeiro. Dá para
silenciar no botão de alto-falante da barra superior.

A **mira** trava no código: quatro cantos contornando a etiqueta, com
folga, sem nunca pintar por cima dela. Fica ciano enquanto confirma e
**verde quando o código entra no inventário** — é assim que se
distingue "achei" de "já contei".

O seletor **Vista**, na barra superior, mostra a cena como o leitor a
enxerga:

| Vista | Para quê |
|-------|----------|
| Câmera | a imagem crua |
| Preto e branco | o ponto de partida do leitor |
| Contraste local | prateleira escura com um ponto de luz estourado |
| Realce de borda | devolve a borda que o movimento borrou |
| Binarizada | etiqueta impressa bem iluminada |
| Binarizada por região | metade da etiqueta na sombra |
| Binarizada invertida | etiqueta clara sobre fundo escuro |

Se o código não está sendo lido, troque para as binarizadas: se a
etiqueta aparecer suja, borrada ou estourada ali, o problema é de
iluminação ou distância — não do leitor.

Selecione a empresa e clique em **Iniciar leitura**. No aplicativo esse
botão não dispara mais o scanner de tela: ele sobe o Agent do drone e
abre a **tela de voo** em tela cheia, com a câmera do drone ao vivo, as
métricas no topo e as leituras entrando à direita. `ESC` ou **Encerrar**
fecha e desliga o Agent.

Dá para conferir tudo isso sem drone:

```bash
cd desktop
npm run smoke
```

O teste de fumaça percorre a cadeia inteira do botão — sobe o Agent com
a fonte sintética, confere a porta que ele anuncia, o `/estado` e o
`/video`. Se ele passar, a tela de voo tem imagem.

E para inspecionar só a tela, sem empacotar nada:

```bash
cd gestock-drone-agent && .venv\Scripts\python -m src.main --driver synthetic --qr --servidor
```

```bash
cd frontend && npm run preview:ui
```

Abra `http://127.0.0.1:5174/qa/index.html` e escolha **cockpit**.

Para gerar o instalador `.exe`:

```bash
npm run dist:win
```

Sai em `desktop/dist-app/`.

---

## 6. O drone de verdade

**Passo 1 — conecte o notebook na Wi-Fi do drone** (`FLOW-UFO_...`).
Enquanto estiver nela, o notebook **não tem internet**. É esperado.

**Passo 2 — vídeo primeiro, sem QR:**

```bash
cd gestock-drone-agent
.venv\Scripts\python -m src.main --driver flow-ufo
```

Provar o vídeo antes de ligar a leitura economiza muito tempo: se o
stream não abre, o problema não tem nada a ver com QR.

**Passo 3 — agora com leitura:**

```bash
.venv\Scripts\python -m src.main --driver flow-ufo --qr
```

### Se der problema

Rode o diagnóstico antes de qualquer outra coisa:

```bash
.venv\Scripts\python -m src.doctor
```

| Erro | Causa e saída |
|------|---------------|
| `461 Unsupported Transport` | o firmware recusa transporte imposto. Use `--transport auto` (já é o padrão) — **não** force `tcp` |
| `illegal hardware instruction` | os binários do OpenCV não rodam nessa CPU. Use `--backend ffmpeg` |
| `Porta 192.168.1.1:7070 não respondeu` | o notebook saiu da Wi-Fi do drone e voltou para a rede de casa |
| vídeo trava depois de alguns segundos | normal em Wi-Fi fraco; o Agent reconecta sozinho, veja `reconexoes` subir |

---

## Resumo em quatro comandos

```bash
cd gestock-drone-agent
.venv\Scripts\python tests\test_qr.py                                   # o código está são
.venv\Scripts\python -m src.main --driver synthetic --qr --headless --duration 10   # o leitor lê
.venv\Scripts\python scripts\gerar_qr.py                                # etiquetas para imprimir
.venv\Scripts\python -m src.main --driver usb --qr                      # leitura com câmera real
```
