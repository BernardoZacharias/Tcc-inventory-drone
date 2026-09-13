"""
local_sources.py — fontes que não dependem do drone.

Servem para desenvolver e testar o Agent inteiro (VideoEngine, reconexão,
mais tarde o QR Engine) sem precisar do FLOW-UFO ligado na mesa:

  UsbCameraDriver ..... webcam do notebook
  VideoFileDriver ..... um arquivo .mp4 gravado do voo
  SyntheticDriver ..... imagem gerada em memória, com QR de verdade

O SyntheticDriver é o que permite rodar teste automatizado em qualquer
máquina — inclusive numa que não tenha câmera nenhuma.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Optional, Tuple

from .base import BaseDroneDriver, DriverInfo

log = logging.getLogger(__name__)


class _OpenCvCaptureDriver(BaseDroneDriver):
    """Base para fontes que o OpenCV abre direto (webcam, arquivo)."""

    NAME = "captura"
    KIND = "local"

    def __init__(self, source: Any) -> None:
        super().__init__()
        self.source = source
        self._cap: Optional[Any] = None

    def describe(self) -> DriverInfo:
        return DriverInfo(name=self.NAME, kind=self.KIND, source=str(self.source))

    def connect(self) -> bool:
        import cv2

        self._status.connect_attempts += 1
        cap = cv2.VideoCapture(self.source)
        if not cap.isOpened():
            cap.release()
            self._status.connected = False
            self._status.last_error = f"não abriu: {self.source}"
            return False
        self._cap = cap
        self._status.connected = True
        self._status.last_error = ""
        return True

    def read(self) -> Tuple[bool, Optional[Any]]:
        if self._cap is None:
            return False, None
        ok, frame = self._cap.read()
        if ok and frame is not None:
            self._mark_frame()
            return True, frame
        self._mark_failure("frame vazio")
        return False, None

    def disconnect(self) -> None:
        if self._cap is not None:
            try:
                self._cap.release()
            except Exception:  # noqa: BLE001
                pass
            self._cap = None
        self._status.connected = False


class UsbCameraDriver(_OpenCvCaptureDriver):
    """Webcam local. `index` costuma ser 0."""

    NAME = "Câmera USB"
    KIND = "usb"

    def __init__(self, index: int = 0) -> None:
        super().__init__(index)


class VideoFileDriver(_OpenCvCaptureDriver):
    """
    Arquivo de vídeo — ótimo para o Plano B da apresentação:
    grave um voo real e reproduza. Do ponto de vista do resto do
    sistema é indistinguível do drone ao vivo.
    """

    NAME = "Arquivo de vídeo"
    KIND = "file"

    def __init__(self, path: str, loop: bool = True) -> None:
        super().__init__(path)
        self.loop = loop

    def read(self) -> Tuple[bool, Optional[Any]]:
        ok, frame = super().read()
        if not ok and self.loop and self._cap is not None:
            import cv2

            # Fim do arquivo: volta ao início em vez de "perder conexão"
            self._cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ok, frame = super().read()
        return ok, frame


class SyntheticDriver(BaseDroneDriver):
    """
    Gera frames em memória, sem hardware nenhum.

    Desenha um QR Code de verdade quando o `qrcode` estiver instalado;
    senão desenha um alvo geométrico. Usado nos testes automatizados e
    para validar o Agent numa máquina sem câmera.
    """

    NAME = "Fonte sintética"
    KIND = "synthetic"

    def __init__(self, width: int = 960, height: int = 540, fps: int = 25,
                 payload: str = "PRODUTO ID: 12345 Nome: Teclado Logitech Quantidade: 50") -> None:
        super().__init__()
        self.width, self.height, self.fps = width, height, fps
        self.payload = payload
        self._t0 = 0.0
        self._n = 0
        self._qr: Optional[Any] = None

    def describe(self) -> DriverInfo:
        return DriverInfo(
            name=self.NAME, kind=self.KIND,
            source=f"{self.width}x{self.height}@{self.fps}",
            detail="sem hardware",
        )

    def _montar_qr(self) -> Optional[Any]:
        try:
            import cv2
            import numpy as np
            import qrcode  # opcional

            img = qrcode.make(self.payload).convert("RGB")
            arr = np.array(img)
            return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
        except Exception:  # noqa: BLE001 - qrcode é opcional
            return None

    def connect(self) -> bool:
        self._status.connect_attempts += 1
        self._t0 = time.monotonic()
        self._qr = self._montar_qr()
        self._status.connected = True
        return True

    def read(self) -> Tuple[bool, Optional[Any]]:
        import cv2
        import numpy as np

        if not self._status.connected:
            return False, None

        # Respeita o FPS pedido para simular um stream de verdade
        alvo = self._t0 + self._n / self.fps
        atraso = alvo - time.monotonic()
        if atraso > 0:
            time.sleep(atraso)

        frame = np.full((self.height, self.width, 3), 24, dtype=np.uint8)
        cv2.putText(frame, "GESTOCK - FONTE SINTETICA", (24, 44),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (200, 200, 200), 2)
        cv2.putText(frame, f"frame {self._n}", (24, self.height - 24),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (120, 200, 255), 1)

        if self._qr is not None:
            lado = min(self.height - 140, 300)
            qr = cv2.resize(self._qr, (lado, lado), interpolation=cv2.INTER_NEAREST)
            # Move o QR devagar, como um drone sobrevoando a prateleira
            desloc = int(40 * np.sin(self._n / 25.0))
            x = (self.width - lado) // 2 + desloc
            y = (self.height - lado) // 2
            frame[y:y + lado, x:x + lado] = qr
        else:
            cv2.rectangle(frame, (self.width // 2 - 90, self.height // 2 - 90),
                          (self.width // 2 + 90, self.height // 2 + 90), (0, 213, 255), 3)

        self._n += 1
        self._mark_frame()
        return True, frame

    def disconnect(self) -> None:
        self._status.connected = False
