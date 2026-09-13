"""
base.py — contrato que todo drone/câmera precisa cumprir.

Esta é a peça central da arquitetura: o resto da aplicação (VideoEngine,
QR Engine, Cloud Sync) NUNCA conversa com um drone específico. Conversa
com esta interface.

Consequência prática: trocar o FLOW-UFO por outro equipamento significa
escrever UM arquivo novo aqui dentro. Nada acima muda.

    VideoEngine  ──▶  BaseDroneDriver  ◀──┬── FlowUfoDriver
                                          ├── RtspGenericDriver
                                          ├── UsbCameraDriver
                                          └── VideoFileDriver
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional, Tuple


@dataclass
class DriverInfo:
    """Identidade do equipamento — o que mostramos ao operador."""

    name: str
    kind: str
    source: str
    detail: str = ""

    def __str__(self) -> str:
        return f"{self.name} ({self.kind}) -> {self.source}"


@dataclass
class DriverStatus:
    """Estado atual da conexão. Só leitura, para a UI e o health monitor."""

    connected: bool = False
    frames_read: int = 0
    read_failures: int = 0
    connect_attempts: int = 0
    last_frame_at: Optional[float] = None
    last_error: str = ""
    extra: dict = field(default_factory=dict)

    @property
    def seconds_since_frame(self) -> Optional[float]:
        if self.last_frame_at is None:
            return None
        return time.monotonic() - self.last_frame_at


class DriverError(Exception):
    """Falha de driver: não conseguiu conectar ou perdeu a fonte."""


class BaseDroneDriver(ABC):
    """
    Interface mínima de uma fonte de vídeo.

    Regras para quem implementar:

    * `connect()` deve ser idempotente — chamar duas vezes não quebra.
    * `read()` NUNCA deve levantar exceção por um frame perdido. Frame
      perdido é normal em Wi-Fi; devolve (False, None) e segue. Só
      levante DriverError se a fonte estiver realmente morta.
    * `disconnect()` deve ser seguro mesmo sem nunca ter conectado.
    * Nada de `print()`: use o logger. O Agent pode rodar sem console.
    """

    def __init__(self) -> None:
        self._status = DriverStatus()

    # ── identidade ────────────────────────────────────────────────
    @abstractmethod
    def describe(self) -> DriverInfo:
        """Quem é este equipamento (para log e para a UI)."""

    # ── ciclo de vida ─────────────────────────────────────────────
    @abstractmethod
    def connect(self) -> bool:
        """Abre a fonte. True se conseguiu. Não deve levantar em falha
        previsível (drone desligado, fora de alcance)."""

    @abstractmethod
    def read(self) -> Tuple[bool, Optional[Any]]:
        """Devolve (ok, frame). Frame é um ndarray BGR do OpenCV."""

    @abstractmethod
    def disconnect(self) -> None:
        """Libera a fonte. Seguro chamar a qualquer momento."""

    def reconnect(self) -> bool:
        """Fecha e reabre. Sobrescreva só se o equipamento precisar de
        um ritual diferente (re-login, re-handshake, etc.)."""
        self.disconnect()
        return self.connect()

    # ── observabilidade ───────────────────────────────────────────
    @property
    def status(self) -> DriverStatus:
        return self._status

    @property
    def is_connected(self) -> bool:
        return self._status.connected

    # ── helpers para as subclasses ────────────────────────────────
    def _mark_frame(self) -> None:
        self._status.frames_read += 1
        self._status.last_frame_at = time.monotonic()

    def _mark_failure(self, motivo: str = "") -> None:
        self._status.read_failures += 1
        if motivo:
            self._status.last_error = motivo

    # ── uso como context manager ──────────────────────────────────
    def __enter__(self) -> "BaseDroneDriver":
        self.connect()
        return self

    def __exit__(self, *_exc: object) -> None:
        self.disconnect()
