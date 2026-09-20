"""
qr_reader.py — QR Engine: transforma quadros em leituras confiáveis.

Reaproveita o pipeline de imagem validado no vision-python (CLAHE,
unsharp, Otsu, adaptativo), agora recebendo o frame do VideoEngine em
vez de capturar a tela.

E acrescenta o que faltava:

1. CONFIRMAÇÃO EM MÚLTIPLOS QUADROS
   Um código só é aceito depois de aparecer em N dos últimos M quadros.
   Decodificação isolada erra: um reflexo, um borrão de movimento ou
   meio QR entrando no enquadramento produzem leitura fantasma.

2. DEDUPLICAÇÃO POR SESSÃO
   O código antigo guardava apenas o ÚLTIMO QR lido. Lendo A, depois B,
   depois A de novo, o segundo A era reenviado — e o inventário
   contava duas vezes.

3. POSIÇÃO DO CÓDIGO NO QUADRO
   Cada achado traz o polígono onde o QR está, já convertido de volta
   para as coordenadas do quadro ORIGINAL. É o que permite a tela
   desenhar a mira em cima do lugar certo mesmo com recorte e upscale
   ligados.

─────────────────────────────────────────────────────────────────
AS DUAS COISAS QUE FAZEM ISTO SER RÁPIDO

O gasto real não é filtrar a imagem, é CHAMAR O DECODIFICADOR. Cada
tentativa do zbar custa muito mais que um threshold. Então as duas
otimizações atacam o número de tentativas, não o número de filtros:

a) COMEÇA PELA QUE FUNCIONOU. A iluminação de um galpão não muda a cada
   quadro: a variante que leu a etiqueta anterior quase sempre lê a
   próxima. Guardar o vencedor troca 4 tentativas por 1.

b) VARREDURA ROTATIVA QUANDO NÃO HÁ NADA. O caso comum é o quadro
   VAZIO — e era o mais caro, porque percorria as 6 variantes até
   desistir. Agora, sem código à vista, cada quadro experimenta só
   algumas variantes e a próxima continua de onde parou. Em três
   quadros cobre tudo, e como a aceitação já exige confirmação em
   múltiplos quadros, não se perde nada em qualidade.
─────────────────────────────────────────────────────────────────

O motor não fala com a API nem grava em banco: ele só entrega leituras
confirmadas. Quem decide o que fazer com elas é a camada de cima.
"""

from __future__ import annotations

import logging
import re
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from .parser import QrLido, parse_qr
from .pipeline import ORDEM_PADRAO, Pipeline

log = logging.getLogger(__name__)


# Faixas que só aparecem em texto japonês: katakana de meia largura,
# kana e kanji. Numa etiqueta de estoque brasileiro, encontrar isso não
# significa japonês — significa que o acento foi lido errado.
_SUSPEITO_CJK = re.compile("[\\uff61-\\uff9f\\u3000-\\u30ff\\u4e00-\\u9fff]")


def texto_do_qr(dados: bytes) -> str:
    """
    Converte os bytes do QR no texto certo, desfazendo o erro de charset.

    O PORQUÊ: a especificação do QR Code manda interpretar o modo byte
    como Shift-JIS quando o código não traz o marcador ECI. O zbar
    obedece à letra. Só que os geradores (o nosso incluído) escrevem
    UTF-8 sem ECI — então "Frágil: Não" volta como katakana.

    Como a conversão é determinística, ela é reversível: re-encodar em
    Shift-JIS devolve os bytes originais, que aí sim são UTF-8.

    O teste é seguro para um QR japonês de verdade: naqueles bytes a
    releitura como UTF-8 falha, e o texto original é mantido.
    """
    try:
        texto = dados.decode("utf-8")
    except UnicodeDecodeError:
        # Nem UTF-8 nem Shift-JIS: gerador antigo cuspindo ISO-8859-1.
        return dados.decode("latin-1", "replace").strip()

    if _SUSPEITO_CJK.search(texto):
        for charset in ("shift_jis", "cp932"):
            try:
                recuperado = texto.encode(charset).decode("utf-8")
            except (UnicodeEncodeError, UnicodeDecodeError):
                continue
            if not _SUSPEITO_CJK.search(recuperado):
                log.debug("charset do QR corrigido via %s", charset)
                return recuperado.strip()

    return texto.strip()


_decodificador = None


def _decodificador_de_qr():
    """
    O decodificador do zbar, restrito a QR Code.

    ISTO É A MAIOR OTIMIZAÇÃO DO LEITOR, e não é microajuste: medido
    nesta máquina, restringir o formato deixa a decodificação **4 a 5
    vezes mais rápida**.

    Por padrão o zbar procura TODOS os simbologias que conhece — EAN,
    UPC, CODE 39, CODE 128, ITF, PDF417, DataBar — passando cada
    decodificador por cada linha de varredura da imagem. Nosso sistema
    só usa QR: todo esse trabalho era jogado fora.

    De quebra, resolve um efeito colateral feio: o decodificador de
    PDF417 do zbar cospe `Assertion failed` no stderr quando encontra
    ruído, e essa enxurrada ia parar no log do aplicativo, escondendo
    as mensagens que importam.

    Devolve None quando o pyzbar não está disponível.
    """
    global _decodificador
    if _decodificador is not None:
        return _decodificador

    try:
        from pyzbar.pyzbar import ZBarSymbol
        from pyzbar.pyzbar import decode as zbar_decode
    except Exception:  # noqa: BLE001
        return None

    try:
        apenas_qr = [ZBarSymbol.QRCODE]

        def decodificar(imagem):
            return zbar_decode(imagem, symbols=apenas_qr)
    except Exception:  # noqa: BLE001 - pyzbar antigo, sem filtro
        log.warning("pyzbar sem filtro de simbologia: a leitura vai ser "
                    "mais lenta. Atualize com: pip install -U pyzbar")
        decodificar = zbar_decode

    _decodificador = decodificar
    return _decodificador


@dataclass
class Achado:
    """Um QR visto neste quadro — ainda não necessariamente aceito."""

    codigo: str
    estrategia: str
    # Cantos do código em coordenadas do quadro ORIGINAL. É o que a
    # tela usa para desenhar a mira no lugar certo.
    pontos: List[Tuple[int, int]] = field(default_factory=list)


@dataclass
class Leitura:
    """Um QR confirmado, pronto para ser registrado."""

    codigo: str
    dados: QrLido
    estrategia: str          # qual variante da imagem conseguiu ler
    confirmacoes: int
    pontos: List[Tuple[int, int]] = field(default_factory=list)
    em: float = field(default_factory=time.time)


@dataclass
class EstatisticasQr:
    quadros: int = 0
    decodificacoes: int = 0       # quantas vezes algum código foi lido
    confirmadas: int = 0          # leituras aceitas (únicas)
    duplicados: int = 0           # repetições descartadas
    descartadas_por_confirmacao: int = 0
    tentativas: int = 0           # chamadas ao decodificador
    ms_total: float = 0.0         # tempo gasto analisando

    # Por variante: quantas vezes foi tentada, quantas acertou, e quanto
    # custou. É o que permite ao operador escolher a configuração certa
    # para o galpão dele em vez de adivinhar.
    por_estrategia: Dict[str, Dict[str, float]] = field(default_factory=dict)

    def registrar(self, nome: str, acertou: bool, ms: float) -> None:
        e = self.por_estrategia.setdefault(
            nome, {"tentativas": 0, "acertos": 0, "ms": 0.0})
        e["tentativas"] += 1
        e["ms"] += ms
        if acertou:
            e["acertos"] += 1

    def resumo(self) -> dict:
        # Tentativas POR QUADRO é a medida honesta de custo: quanto
        # menor, mais rápido o leitor reage.
        por_quadro = (self.tentativas / self.quadros) if self.quadros else 0.0
        return {
            "quadros": self.quadros,
            "leituras": self.confirmadas,
            "duplicados": self.duplicados,
            "decodificacoes": self.decodificacoes,
            "tentativas_por_quadro": round(por_quadro, 2),
            "ms_por_quadro": round(
                (self.ms_total / self.quadros) if self.quadros else 0.0, 1),
            "estrategias": {
                nome: {
                    "tentativas": int(e["tentativas"]),
                    "acertos": int(e["acertos"]),
                    "ms_media": round(e["ms"] / e["tentativas"], 2)
                    if e["tentativas"] else 0.0,
                }
                for nome, e in sorted(self.por_estrategia.items())
            },
        }


class QrEngine:
    """
    Recebe quadros, devolve leituras confirmadas e sem repetição.

        engine = QrEngine()
        for frame in ...:
            for leitura in engine.processar(frame):
                print(leitura.codigo)
            desenhar(engine.alvos)      # a mira
    """

    def __init__(
        self,
        *,
        confirmacoes: int = 2,
        janela: int = 4,
        upscale: float = 1.0,
        recorte: float = 0.0,
        varredura: int = 2,
        intervalo_cv2: int = 5,
        vista: Optional[str] = None,
    ) -> None:
        if confirmacoes > janela:
            raise ValueError("confirmacoes não pode ser maior que a janela")

        self.confirmacoes = confirmacoes
        self.janela = janela
        self.upscale = upscale
        self.recorte = recorte

        # Quantas variantes experimentar por quadro quando NÃO há código
        # à vista. 0 = todas (comportamento antigo, mais lento).
        self.varredura = max(0, varredura)

        # De quantos em quantos quadros sem achado tentar o detector do
        # OpenCV. 1 = todo quadro (mais lento, mais exaustivo).
        self.intervalo_cv2 = max(1, intervalo_cv2)

        # Variante a guardar para a tela de diagnóstico. None = nenhuma,
        # e aí não se gasta nada com isso.
        self.vista = vista
        self.imagem_vista: Optional[Any] = None

        self.stats = EstatisticasQr()

        # Histórico curto: o que foi visto em cada um dos últimos quadros
        self._recentes: deque = deque(maxlen=janela)
        # Códigos já emitidos nesta sessão (a deduplicação de verdade),
        # guardados inteiros: é este o inventário da sessão.
        self._emitidos: Dict[str, Leitura] = {}
        self._repeticoes: Dict[str, int] = {}
        self._clahe = None

        # O que está à vista AGORA, para a tela desenhar a mira.
        self._alvos: List[Achado] = []

        self._vencedora: Optional[str] = None   # variante que leu por último
        self._cursor = 0                        # onde a varredura parou
        self._desde_cv2 = 0                     # quadros desde a última tentativa do OpenCV
        # Escala e deslocamento aplicados no pré-processamento, para
        # converter as coordenadas de volta ao quadro original.
        self._transformacao = (1.0, 0, 0)

    # ── pré-processamento ─────────────────────────────────────────
    def _preparar(self, frame: Any) -> Pipeline:
        """
        Recorta, amplia e devolve o pipeline de variantes do quadro.

        Guarda a transformação aplicada: sem ela, a mira apareceria
        deslocada assim que `--qr-recorte` ou `--qr-upscale` fossem
        usados, porque os pontos do decodificador saem no sistema de
        coordenadas da imagem tratada, não da que o operador vê.
        """
        import cv2

        if self._clahe is None:
            self._clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))

        img = frame
        deslocamento_x = deslocamento_y = 0
        escala = 1.0

        if self.recorte > 0:
            h, w = img.shape[:2]
            deslocamento_x, deslocamento_y = int(w * self.recorte), int(h * self.recorte)
            img = img[deslocamento_y:h - deslocamento_y,
                      deslocamento_x:w - deslocamento_x]

        if self.upscale and self.upscale != 1.0:
            # QR pequeno no fundo do corredor não tem módulos suficientes
            # para decodificar; ampliar antes do threshold recupera parte.
            escala = float(self.upscale)
            img = cv2.resize(img, None, fx=escala, fy=escala,
                             interpolation=cv2.INTER_LANCZOS4)

        self._transformacao = (escala, deslocamento_x, deslocamento_y)
        return Pipeline(img, self._clahe)

    def _para_original(self, pontos) -> List[Tuple[int, int]]:
        """Desfaz upscale e recorte, para a tela desenhar no lugar certo."""
        escala, dx, dy = self._transformacao
        saida = []
        for p in pontos:
            x, y = (p.x, p.y) if hasattr(p, "x") else (p[0], p[1])
            saida.append((int(x / escala) + dx, int(y / escala) + dy))
        return saida

    # ── ordem de tentativa ────────────────────────────────────────
    def _ordem(self, tem_alvo: bool) -> List[str]:
        """
        Quais variantes experimentar neste quadro, e em que ordem.

        Com código à vista, vale percorrer tudo: estamos a um quadro de
        confirmar uma leitura e atrasar isso é pior que gastar CPU.

        Sem nada à vista, só uma fatia — e a próxima chamada continua de
        onde esta parou. É isso que derruba o custo do caso comum.
        """
        resto = [n for n in ORDEM_PADRAO if n != self._vencedora]
        completa = ([self._vencedora] + resto) if self._vencedora else list(ORDEM_PADRAO)

        if tem_alvo or self.varredura <= 0 or self.varredura >= len(completa):
            return completa

        # A vencedora entra sempre: é a aposta mais barata que existe.
        escolhidas = [self._vencedora] if self._vencedora else []

        # As demais vagas giram pelo resto, retomando onde o quadro
        # anterior parou — é o rodízio que cobre tudo em poucos quadros.
        faltam = self.varredura - len(escolhidas)
        if faltam > 0 and resto:
            for i in range(faltam):
                escolhidas.append(resto[(self._cursor + i) % len(resto)])
            self._cursor = (self._cursor + faltam) % len(resto)

        return escolhidas

    # ── detecção ──────────────────────────────────────────────────
    def _tentar(self, imagem: Any, nome: str, zbar_decode) -> List[Achado]:
        """Uma tentativa de decodificação, cronometrada."""
        inicio = time.perf_counter()
        achados: List[Achado] = []

        try:
            for a in zbar_decode(imagem):
                try:
                    texto = texto_do_qr(a.data)
                except Exception:  # noqa: BLE001
                    continue
                if texto:
                    achados.append(Achado(
                        codigo=texto, estrategia=nome,
                        pontos=self._para_original(a.polygon or []),
                    ))
        except Exception as exc:  # noqa: BLE001
            log.debug("pyzbar falhou em %s: %s", nome, exc)

        ms = (time.perf_counter() - inicio) * 1000
        self.stats.tentativas += 1
        self.stats.ms_total += ms
        self.stats.registrar(nome, bool(achados), ms)
        return achados

    def _decodificar(self, frame: Any) -> List[Achado]:
        """Devolve os códigos vistos neste quadro, com posição."""
        zbar_decode = _decodificador_de_qr()

        pipeline = self._preparar(frame)
        self.imagem_vista = None

        achados: List[Achado] = []
        if zbar_decode is not None:
            for nome in self._ordem(tem_alvo=bool(self._alvos)):
                try:
                    imagem = pipeline.obter(nome)
                except Exception as exc:  # noqa: BLE001
                    log.debug("variante %s falhou: %s", nome, exc)
                    continue

                achados = self._tentar(imagem, nome, zbar_decode)
                if achados:
                    # Apostar nesta primeiro no próximo quadro.
                    self._vencedora = nome
                    break

        # Último recurso: o detector do próprio OpenCV. Lê casos que o
        # zbar recusa (e vice-versa), e não sofre do problema de
        # charset, porque não faz a conversão Shift-JIS que a norma pede.
        #
        # Mas ele é caro e NÃO roda em todo quadro. Rodar sempre custava
        # ~26 ms em cada quadro vazio — justamente o quadro mais comum —
        # para confirmar o que o zbar já tinha dito. Aqui ele entra de
        # tempos em tempos: se há um código que só ele lê, o rodízio
        # chega nele em menos de meio segundo, e a confirmação em
        # múltiplos quadros absorve essa espera.
        if not achados:
            self._desde_cv2 += 1
            if self._desde_cv2 >= self.intervalo_cv2:
                self._desde_cv2 = 0
                achados = self._tentar_opencv(pipeline)

        # A vista de diagnóstico é calculada DEPOIS da decisão, para não
        # entrar no caminho crítico. Fora do modo diagnóstico não custa
        # nada, porque `vista` é None.
        if self.vista:
            try:
                self.imagem_vista = pipeline.obter(self.vista)
            except Exception as exc:  # noqa: BLE001
                log.debug("vista %s indisponível: %s", self.vista, exc)

        return achados

    def _tentar_opencv(self, pipeline: Pipeline) -> List[Achado]:
        try:
            import cv2

            base = pipeline.obter("ORIGINAL")
            detector = cv2.QRCodeDetector()
            inicio = time.perf_counter()
            texto, pontos, _ = detector.detectAndDecode(base)
            ms = (time.perf_counter() - inicio) * 1000

            self.stats.tentativas += 1
            self.stats.ms_total += ms
            self.stats.registrar("CV2", bool(texto), ms)

            if texto and pontos is not None:
                cantos = [(int(p[0]), int(p[1])) for p in pontos.reshape(-1, 2)]
                self._vencedora = None   # o CV2 não entra no rodízio
                return [Achado(codigo=texto.strip(), estrategia="CV2",
                               pontos=self._para_original(cantos))]
        except Exception as exc:  # noqa: BLE001
            log.debug("QRCodeDetector falhou: %s", exc)
        return []

    # ── ciclo principal ───────────────────────────────────────────
    def processar(self, frame: Any) -> List[Leitura]:
        """
        Processa um quadro e devolve só as leituras NOVAS e CONFIRMADAS.
        Na maioria dos quadros devolve lista vazia — e isso é o normal.

        Para desenhar a mira, use `alvos`: ali estão TODOS os códigos à
        vista, inclusive os já contados, porque a mira acompanha o que o
        drone está vendo e não o que ele acabou de registrar.
        """
        if frame is None:
            return []

        self.stats.quadros += 1
        achados = self._decodificar(frame)
        self._alvos = achados

        vistos_agora = {a.codigo for a in achados}
        self._recentes.append(vistos_agora)

        if achados:
            self.stats.decodificacoes += 1

        confirmadas: List[Leitura] = []

        for achado in achados:
            codigo = achado.codigo

            # Já contado nesta sessão? Repetição é esperada (o drone
            # passa pela mesma etiqueta várias vezes) e não é erro.
            if codigo in self._emitidos:
                self._repeticoes[codigo] = self._repeticoes.get(codigo, 0) + 1
                self.stats.duplicados += 1
                continue

            # Quantos dos últimos quadros viram este mesmo código?
            vezes = sum(1 for q in self._recentes if codigo in q)
            if vezes < self.confirmacoes:
                self.stats.descartadas_por_confirmacao += 1
                continue

            leitura = Leitura(codigo=codigo, dados=parse_qr(codigo),
                              estrategia=achado.estrategia, confirmacoes=vezes,
                              pontos=achado.pontos)
            self._emitidos[codigo] = leitura
            self.stats.confirmadas += 1
            confirmadas.append(leitura)

        return confirmadas

    # ── o que a tela precisa ──────────────────────────────────────
    @property
    def alvos(self) -> List[Achado]:
        """Os códigos à vista neste instante — onde desenhar a mira."""
        return list(self._alvos)

    def alvos_serializaveis(self) -> List[dict]:
        """Os alvos no formato que o servidor publica para a tela."""
        return [
            {
                "codigo": a.codigo,
                "pontos": [list(p) for p in a.pontos],
                "estrategia": a.estrategia,
                # Já contado? A tela pinta de cor diferente: o operador
                # precisa distinguir "achei" de "registrei".
                "registrado": a.codigo in self._emitidos,
            }
            for a in self._alvos if a.pontos
        ]

    # ── sessão ────────────────────────────────────────────────────
    def reiniciar_sessao(self) -> None:
        """
        Zera o que já foi lido. Chamado ao iniciar um novo inventário:
        os mesmos códigos devem ser contados de novo na próxima sessão.
        """
        self._emitidos.clear()
        self._repeticoes.clear()
        self._recentes.clear()
        self._alvos = []
        self._vencedora = None
        self._cursor = 0
        self._desde_cv2 = 0
        self.stats = EstatisticasQr()

    @property
    def codigos_lidos(self) -> List[str]:
        return list(self._emitidos)

    def leituras(self) -> List[Leitura]:
        """O inventário da sessão, na ordem em que foi lido."""
        return list(self._emitidos.values())

    def repeticoes(self, codigo: str) -> int:
        """Quantas vezes este código reapareceu depois de contado."""
        return self._repeticoes.get(codigo, 0)
