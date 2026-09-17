"""
qr_reader.py — QR Engine: transforma quadros em leituras confiáveis.

Reaproveita o pipeline de imagem que já estava validado no
vision-python (CLAHE, unsharp, Otsu, threshold adaptativo), agora
recebendo o frame do VideoEngine em vez de capturar a tela.

E acrescenta as duas coisas que faltavam:

1. CONFIRMAÇÃO EM MÚLTIPLOS QUADROS
   Um código só é aceito depois de aparecer em N dos últimos M quadros.
   Decodificação isolada erra: um reflexo, um borrão de movimento ou
   meio QR entrando no enquadramento produzem leitura fantasma. Exigir
   repetição custa alguns décimos de segundo e elimina isso.

2. DEDUPLICAÇÃO POR SESSÃO
   O código antigo guardava apenas o ÚLTIMO QR lido. Lendo A, depois B,
   depois A de novo, o segundo A era reenviado — e o inventário
   contava duas vezes. Aqui cada código é emitido UMA vez por sessão, e
   as repetições viram contador de "duplicados ignorados".

O motor não fala com a API nem grava em banco: ele só entrega leituras
confirmadas. Quem decide o que fazer com elas é a camada de cima.
"""

from __future__ import annotations

import logging
import re
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Dict, List

from .parser import QrLido, parse_qr

log = logging.getLogger(__name__)


# Faixas que só aparecem em texto japonês: katakana de meia largura,
# kana e kanji. Numa etiqueta de estoque brasileiro, encontrar isso não
# significa japonês — significa que o acento foi lido errado.
_SUSPEITO_CJK = re.compile(r"[｡-ﾟ　-ヿ一-鿿]")


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


@dataclass
class Leitura:
    """Um QR confirmado, pronto para ser registrado."""

    codigo: str
    dados: QrLido
    estrategia: str          # qual variante da imagem conseguiu ler
    confirmacoes: int
    em: float = field(default_factory=time.time)


@dataclass
class EstatisticasQr:
    quadros: int = 0
    decodificacoes: int = 0       # quantas vezes algum código foi lido
    confirmadas: int = 0          # leituras aceitas (únicas)
    duplicados: int = 0           # repetições descartadas
    descartadas_por_confirmacao: int = 0

    def resumo(self) -> dict:
        return {
            "quadros": self.quadros,
            "leituras": self.confirmadas,
            "duplicados": self.duplicados,
            "decodificacoes": self.decodificacoes,
        }


class QrEngine:
    """
    Recebe quadros, devolve leituras confirmadas e sem repetição.

        engine = QrEngine()
        for frame in ...:
            for leitura in engine.processar(frame):
                print(leitura.codigo)
    """

    def __init__(
        self,
        *,
        confirmacoes: int = 2,
        janela: int = 4,
        upscale: float = 1.0,
        recorte: float = 0.0,
    ) -> None:
        if confirmacoes > janela:
            raise ValueError("confirmacoes não pode ser maior que a janela")

        self.confirmacoes = confirmacoes
        self.janela = janela
        self.upscale = upscale
        self.recorte = recorte

        self.stats = EstatisticasQr()

        # Histórico curto: o que foi visto em cada um dos últimos quadros
        self._recentes: deque = deque(maxlen=janela)
        # Códigos já emitidos nesta sessão (a deduplicação de verdade),
        # guardados inteiros: é este o inventário da sessão.
        self._emitidos: Dict[str, Leitura] = {}
        self._repeticoes: Dict[str, int] = {}
        self._clahe = None

    # ── pré-processamento ─────────────────────────────────────────
    def _preparar(self, frame: Any):
        """
        Devolve `(base, variantes)`.

        `base` é o quadro já recortado e ampliado — o mesmo território
        que as variantes enxergam. Quem tentar decodificar tem que usar
        ele, e não o quadro original, senão `--qr-recorte` e
        `--qr-upscale` valeriam para um caminho e não para o outro.

        `variantes` vai da mais barata para a mais cara. A ordem importa:
        quase sempre a primeira já resolve, e aí as outras nem são
        calculadas. Rodar as seis em todo quadro seria desperdício de CPU
        num stream de 25 fps.
        """
        import cv2

        if self._clahe is None:
            self._clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))

        img = frame

        if self.recorte > 0:
            h, w = img.shape[:2]
            mx, my = int(w * self.recorte), int(h * self.recorte)
            img = img[my:h - my, mx:w - mx]

        if self.upscale and self.upscale != 1.0:
            # QR pequeno no fundo do corredor não tem módulos suficientes
            # para decodificar; ampliar antes do threshold recupera parte.
            img = cv2.resize(img, None, fx=self.upscale, fy=self.upscale,
                             interpolation=cv2.INTER_LANCZOS4)

        cinza = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img

        def variantes():
            yield "CINZA", cinza

            clahe = self._clahe.apply(cinza)
            yield "CLAHE", clahe

            # Unsharp: devolve a borda que o movimento do drone apagou
            desfoque = cv2.GaussianBlur(clahe, (0, 0), sigmaX=1.5)
            yield "SHARP", cv2.addWeighted(clahe, 1.6, desfoque, -0.6, 0)

            _, otsu = cv2.threshold(clahe, 0, 255,
                                    cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            yield "OTSU", otsu

            yield "ADAPT", cv2.adaptiveThreshold(
                clahe, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY, blockSize=15, C=4)

            # QR claro sobre fundo escuro — acontece com etiqueta sob
            # luz direta do galpão
            yield "OTSU_INV", cv2.bitwise_not(otsu)

        return img, variantes()

    # ── detecção ──────────────────────────────────────────────────
    def _decodificar(self, frame: Any) -> List[tuple]:
        """Devolve [(codigo, estrategia)] do primeiro método que ler."""
        try:
            from pyzbar.pyzbar import decode as zbar_decode
        except Exception:  # noqa: BLE001
            zbar_decode = None

        base, variantes = self._preparar(frame)

        for nome, img in variantes:
            if zbar_decode is not None:
                try:
                    achados = zbar_decode(img)
                except Exception as exc:  # noqa: BLE001
                    log.debug("pyzbar falhou em %s: %s", nome, exc)
                    achados = []

                if achados:
                    saida = []
                    for a in achados:
                        try:
                            texto = texto_do_qr(a.data)
                        except Exception:  # noqa: BLE001
                            continue
                        if texto:
                            saida.append((texto, nome))
                    if saida:
                        return saida

        # Último recurso: o detector do próprio OpenCV. Lê casos que o
        # zbar recusa (e vice-versa), então vale a tentativa extra — e
        # ele não sofre do problema de charset, porque não faz a
        # conversão Shift-JIS que a norma pede.
        try:
            import cv2

            detector = cv2.QRCodeDetector()
            texto, pontos, _ = detector.detectAndDecode(base)
            if texto and pontos is not None:
                return [(texto.strip(), "CV2")]
        except Exception as exc:  # noqa: BLE001
            log.debug("QRCodeDetector falhou: %s", exc)

        return []

    # ── ciclo principal ───────────────────────────────────────────
    def processar(self, frame: Any) -> List[Leitura]:
        """
        Processa um quadro e devolve só as leituras NOVAS e CONFIRMADAS.
        Na maioria dos quadros devolve lista vazia — e isso é o normal.
        """
        if frame is None:
            return []

        self.stats.quadros += 1
        achados = self._decodificar(frame)
        vistos_agora = {c for c, _ in achados}
        self._recentes.append(vistos_agora)

        if achados:
            self.stats.decodificacoes += 1

        confirmadas: List[Leitura] = []

        for codigo, estrategia in achados:
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
                              estrategia=estrategia, confirmacoes=vezes)
            self._emitidos[codigo] = leitura
            self.stats.confirmadas += 1
            confirmadas.append(leitura)

        return confirmadas

    # ── sessão ────────────────────────────────────────────────────
    def reiniciar_sessao(self) -> None:
        """
        Zera o que já foi lido. Chamado ao iniciar um novo inventário:
        os mesmos códigos devem ser contados de novo na próxima sessão.
        """
        self._emitidos.clear()
        self._repeticoes.clear()
        self._recentes.clear()
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
