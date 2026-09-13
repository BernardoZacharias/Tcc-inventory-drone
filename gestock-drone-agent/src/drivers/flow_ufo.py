"""
flow_ufo.py — driver do drone FLOW-UFO.

Parâmetros confirmados por engenharia reversa (nmap + ffplay):

    Rede Wi-Fi ...... FLOW-UFO_28962e
    IP do drone ..... 192.168.1.1
    Porta ........... 7070/tcp  (nmap: aberta, "realserver?")
    Endpoint ........ /webcam
    Stream .......... rtsp://192.168.1.1:7070/webcam

Tudo que é específico deste equipamento mora AQUI. Se amanhã o drone
for outro, escreve-se outro arquivo neste diretório e nada acima muda.
"""

from __future__ import annotations

import logging

from .base import DriverInfo
from .rtsp_generic import RtspGenericDriver

log = logging.getLogger(__name__)


class FlowUfoDriver(RtspGenericDriver):
    """Drone FLOW-UFO — stream RTSP direto, sem celular e sem scrcpy."""

    NAME = "FLOW-UFO"
    KIND = "drone-rtsp"

    DEFAULT_IP = "192.168.1.1"
    DEFAULT_PORT = 7070
    DEFAULT_PATH = "/webcam"
    WIFI_SSID_PREFIX = "FLOW-UFO"

    def __init__(
        self,
        ip: str = DEFAULT_IP,
        port: int = DEFAULT_PORT,
        path: str = DEFAULT_PATH,
        *,
        transport: str = "auto",
        **kwargs: object,
    ) -> None:
        self.ip = ip
        self.port = port
        self.path = path if path.startswith("/") else f"/{path}"
        url = f"rtsp://{ip}:{port}{self.path}"
        super().__init__(url, transport=transport, **kwargs)  # type: ignore[arg-type]

    def describe(self) -> DriverInfo:
        return DriverInfo(
            name=self.NAME,
            kind=self.KIND,
            source=self.url,
            detail=f"Wi-Fi {self.WIFI_SSID_PREFIX}* · transporte={self.transport}",
        )

    def connect(self) -> bool:
        """
        Antes de abrir o stream (que é lento), confere se a porta 7070
        está aberta.

        Por que isso importa: 192.168.1.1 é o IP de roteador doméstico
        mais comum que existe. Se o notebook estiver na rede de casa em
        vez da rede do drone, o ping responde e o IP "parece certo" —
        mas não é o drone. A porta 7070 aberta é evidência bem melhor.
        """
        if not self.probe(timeout=2.0):
            self._status.connected = False
            log.warning(
                "Porta %s:%s não respondeu. O notebook está conectado na "
                "rede Wi-Fi do drone (%s*)?",
                self.ip, self.port, self.WIFI_SSID_PREFIX,
            )
            return False

        log.info("Porta %s:%s aberta — parece ser o drone. Abrindo vídeo...", self.ip, self.port)
        return super().connect()
