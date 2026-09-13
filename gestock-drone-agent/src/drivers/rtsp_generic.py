"""
rtsp_generic.py — fonte RTSP genérica (qualquer câmera/drone com RTSP).

É a base do FlowUfoDriver. Concentra aqui a parte chata do RTSP:

  * opções de baixa latência do FFmpeg
  * buffer de 1 frame (senão o OpenCV enfileira e você lê o passado)
  * timeout de socket, para não travar eternamente num drone desligado
  * tolerância a frame perdido (normal em Wi-Fi)
"""

from __future__ import annotations

import logging
import os
import socket
import time
from typing import Any, Optional, Tuple
from urllib.parse import urlparse

from .base import BaseDroneDriver, DriverInfo

log = logging.getLogger(__name__)


def _aplicar_opcoes_ffmpeg(transport: str, timeout_us: int) -> None:
    """
    Configura o backend FFmpeg do OpenCV.

    IMPORTANTE: precisa acontecer ANTES de instanciar o VideoCapture —
    o OpenCV lê esta variável de ambiente no momento em que abre a fonte.

    `stimeout` é o nome antigo do timeout de socket (microssegundos);
    versões recentes do FFmpeg usam `timeout`. Mandamos os dois: o
    FFmpeg ignora a opção que não conhece em vez de falhar.
    """
    opcoes = [
        f"rtsp_transport;{transport}",
        "fflags;nobuffer",
        "flags;low_delay",
        "max_delay;500000",
        f"stimeout;{timeout_us}",
        f"timeout;{timeout_us}",
        "reorder_queue_size;0",
    ]
    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "|".join(opcoes)


class RtspGenericDriver(BaseDroneDriver):
    """Abre um stream RTSP e entrega frames BGR."""

    NAME = "RTSP genérico"
    KIND = "rtsp"

    def __init__(
        self,
        url: str,
        *,
        transport: str = "tcp",
        open_timeout: float = 10.0,
        socket_timeout_us: int = 5_000_000,
    ) -> None:
        super().__init__()
        self.url = url
        self.transport = transport
        self.open_timeout = open_timeout
        self.socket_timeout_us = socket_timeout_us
        self._cap: Optional[Any] = None

    # ── identidade ────────────────────────────────────────────────
    def describe(self) -> DriverInfo:
        return DriverInfo(
            name=self.NAME,
            kind=self.KIND,
            source=self.url,
            detail=f"transporte={self.transport}",
        )

    # ── sondagem de rede ──────────────────────────────────────────
    def probe(self, timeout: float = 2.0) -> bool:
        """
        Confere se há ALGO escutando na porta RTSP antes de tentar abrir
        o stream (abrir stream é caro e demora).

        Isto também protege contra o engano clássico: 192.168.1.1 é o IP
        de roteador doméstico mais comum do mundo. Responder ping não
        prova que é o drone — ter a porta 7070 aberta já diz bem mais.
        """
        alvo = urlparse(self.url)
        host, porta = alvo.hostname, alvo.port or 554
        if not host:
            return False
        try:
            with socket.create_connection((host, porta), timeout=timeout):
                return True
        except OSError as exc:
            self._status.last_error = f"porta {host}:{porta} fechada ({exc.__class__.__name__})"
            return False

    # ── ciclo de vida ─────────────────────────────────────────────
    def connect(self) -> bool:
        import cv2  # import tardio: deixa o --help do CLI instantâneo

        if self._cap is not None and self._cap.isOpened():
            return True

        self._status.connect_attempts += 1
        _aplicar_opcoes_ffmpeg(self.transport, self.socket_timeout_us)

        log.info("Abrindo stream: %s (transporte=%s)", self.url, self.transport)
        inicio = time.monotonic()
        cap = cv2.VideoCapture(self.url, cv2.CAP_FFMPEG)

        # Buffer mínimo: queremos o PRESENTE, não a fila do passado.
        # Nem todo backend respeita, por isso o VideoEngine também
        # descarta frames velhos por conta própria.
        try:
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except Exception:  # noqa: BLE001 - backend pode não suportar
            pass

        if not cap.isOpened():
            cap.release()
            self._status.connected = False
            self._status.last_error = "VideoCapture não abriu (drone desligado ou fora de alcance?)"
            log.warning("Falha ao abrir o stream em %.1fs", time.monotonic() - inicio)
            return False

        self._cap = cap
        self._status.connected = True
        self._status.last_error = ""
        self._status.extra.update(
            largura=int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or None,
            altura=int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or None,
            fps_declarado=round(cap.get(cv2.CAP_PROP_FPS) or 0, 2) or None,
        )
        log.info(
            "Stream aberto em %.1fs — %sx%s",
            time.monotonic() - inicio,
            self._status.extra.get("largura"),
            self._status.extra.get("altura"),
        )
        return True

    def read(self) -> Tuple[bool, Optional[Any]]:
        if self._cap is None:
            return False, None

        ok, frame = self._cap.read()
        if ok and frame is not None:
            self._mark_frame()
            return True, frame

        # Frame perdido é rotina em Wi-Fi ("Missing packets; dropping frame").
        # Quem decide que a conexão morreu é o VideoEngine, olhando há
        # quanto tempo nenhum frame BOM chega.
        self._mark_failure("frame vazio")
        return False, None

    def disconnect(self) -> None:
        if self._cap is not None:
            try:
                self._cap.release()
            except Exception as exc:  # noqa: BLE001
                log.debug("Erro ao liberar captura: %s", exc)
            self._cap = None
        self._status.connected = False
