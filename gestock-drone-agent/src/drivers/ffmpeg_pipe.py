"""
ffmpeg_pipe.py — lê frames do binário `ffmpeg`, sem usar o decodificador
do OpenCV.

POR QUE ESTE DRIVER EXISTE
──────────────────────────
O `cv2.VideoCapture` usa um FFmpeg embutido no wheel do opencv-python.
Quando esse binário embutido não combina com a CPU da máquina, o
processo morre com SIGILL ("illegal hardware instruction"), sem exceção
Python para capturar — o processo inteiro cai.

Só que o FFmpeg **do sistema** costuma estar perfeito (é o mesmo que o
`ffplay` usa quando você testa o stream na mão). Então aqui invertemos:
pedimos ao ffmpeg do sistema para decodificar e cuspir frames crus em
BGR na saída padrão, e só remontamos os bytes com numpy.

    ffmpeg -i rtsp://... -f rawvideo -pix_fmt bgr24 -  →  numpy

Vantagens:
  * não depende do FFmpeg embutido no OpenCV (imune ao SIGILL)
  * mesmo binário que você já validou com o ffplay
  * controle fino de latência pelas flags do ffmpeg

Custo: exige `ffmpeg` instalado no sistema.
"""

from __future__ import annotations

import json
import logging
import re
import shutil
import subprocess
import sys
import threading
from collections import deque
from typing import Any, List, Optional, Tuple

from .base import BaseDroneDriver, DriverInfo

log = logging.getLogger(__name__)


_NUMPY_OK: Optional[bool] = None


def numpy_utilizavel() -> bool:
    """
    Diz se dá para importar numpy SEM derrubar o processo.

    Por que em subprocesso: num binário incompatível com a CPU, o
    `import numpy` morre com SIGILL — que NÃO é exceção Python. Um
    try/except não pega; o processo inteiro cai. Então perguntamos a um
    processo sacrificável primeiro, e só importamos aqui se ele voltar
    vivo. O resultado fica em cache: o teste roda uma vez só.
    """
    global _NUMPY_OK
    if _NUMPY_OK is None:
        try:
            r = subprocess.run([sys.executable, "-c", "import numpy"],
                               capture_output=True, timeout=30)
            _NUMPY_OK = r.returncode == 0
        except Exception:  # noqa: BLE001
            _NUMPY_OK = False
        if not _NUMPY_OK:
            log.warning(
                "numpy indisponível nesta máquina (binário incompatível com a "
                "CPU). Os frames virão como bytes crus: o marco 1 (conexão, "
                "vídeo, reconexão) funciona, mas processar pixels vai exigir "
                "consertar o numpy. Rode: python -m src.doctor"
            )
    return _NUMPY_OK


class RawFrame:
    """
    Frame em bytes crus, para quando o numpy não está utilizável.

    Mantém o pipeline vivo (contagem, FPS, reconexão, latência) sem
    depender de numpy. Quem precisar de pixels chama `to_numpy()` —
    que só funciona quando o numpy estiver consertado.
    """

    __slots__ = ("data", "width", "height")

    def __init__(self, data: bytes, width: int, height: int) -> None:
        self.data, self.width, self.height = data, width, height

    @property
    def shape(self) -> Tuple[int, int, int]:
        return (self.height, self.width, 3)

    @property
    def nbytes(self) -> int:
        return len(self.data)

    def to_numpy(self):
        import numpy as np

        return np.frombuffer(self.data, dtype=np.uint8).reshape(self.shape)

    def __repr__(self) -> str:
        return f"RawFrame({self.width}x{self.height}, {len(self.data)} bytes)"


def ffmpeg_disponivel() -> bool:
    return shutil.which("ffmpeg") is not None


def ffprobe_disponivel() -> bool:
    return shutil.which("ffprobe") is not None


def _args_transporte(transport: str) -> list:
    """
    O firmware do FLOW-UFO responde 461 (Unsupported Transport) quando
    o transporte e imposto. Com "auto" nao passamos a flag e deixamos o
    ffmpeg negociar - que e exatamente o que o `ffplay rtsp://...` puro
    faz, e foi assim que o stream funcionou no teste manual.
    """
    return [] if transport == "auto" else ["-rtsp_transport", transport]


def descobrir_resolucao(url: str, transport: str = "auto",
                        timeout: float = 12.0) -> Optional[Tuple[int, int]]:
    """
    Pergunta ao ffprobe qual a resolução do stream.

    Precisamos disso porque o rawvideo não tem cabeçalho: para fatiar a
    saída em frames é obrigatório saber exatamente quantos bytes cada
    frame ocupa (largura × altura × 3).
    """
    # Tentativa 1 — ffprobe, que responde em JSON.
    if ffprobe_disponivel():
        cmd = [
            "ffprobe", "-v", "error",
            *_args_transporte(transport),
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height",
            "-of", "json", url,
        ]
        try:
            saida = subprocess.run(cmd, capture_output=True, timeout=timeout, text=True)
            if saida.returncode == 0:
                streams = json.loads(saida.stdout).get("streams") or []
                if streams:
                    w, h = int(streams[0]["width"]), int(streams[0]["height"])
                    if w > 0 and h > 0:
                        return (w, h)
            log.debug("ffprobe nao resolveu: %s", (saida.stderr or "").strip()[:200])
        except (subprocess.TimeoutExpired, ValueError, KeyError,
                json.JSONDecodeError) as exc:
            log.debug("ffprobe falhou: %s", exc)

    # Tentativa 2 — ler o banner do proprio ffmpeg, que imprime algo como
    #   Stream #0:0: Video: h264 (Main), yuv420p, 1280x720, 25 fps
    # Ha firmwares que engasgam no ffprobe mas abrem normalmente no ffmpeg.
    log.debug("Tentando descobrir a resolucao pelo banner do ffmpeg...")
    cmd = [
        "ffmpeg", "-hide_banner",
        *_args_transporte(transport),
        "-i", url, "-t", "1", "-f", "null", "-",
    ]
    try:
        saida = subprocess.run(cmd, capture_output=True, timeout=timeout, text=True)
        achado = re.search(r"Video:.*?,\s*(\d{2,5})x(\d{2,5})", saida.stderr or "")
        if achado:
            w, h = int(achado.group(1)), int(achado.group(2))
            if w > 0 and h > 0:
                log.debug("Resolucao lida do banner: %sx%s", w, h)
                return (w, h)
        log.debug("banner sem resolucao: %s", (saida.stderr or "").strip()[-300:])
    except subprocess.TimeoutExpired:
        log.debug("ffmpeg nao respondeu ao sondar a resolucao")

    return None


class FfmpegPipeDriver(BaseDroneDriver):
    """Decodifica com o ffmpeg do sistema e entrega ndarray BGR."""

    NAME = "FFmpeg (pipe)"
    KIND = "ffmpeg"

    def __init__(
        self,
        url: str,
        *,
        transport: str = "auto",
        width: Optional[int] = None,
        height: Optional[int] = None,
        timeout_us: int = 5_000_000,
    ) -> None:
        super().__init__()
        self.url = url
        self.transport = transport
        self.width = width
        self.height = height
        self._forcado = bool(width and height)
        self.timeout_us = timeout_us
        self._proc: Optional[subprocess.Popen] = None
        self._stderr_thread: Optional[threading.Thread] = None
        self._stderr_tail: deque = deque(maxlen=12)

    def describe(self) -> DriverInfo:
        tam = f"{self.width}x{self.height}" if self.width else "auto"
        return DriverInfo(name=self.NAME, kind=self.KIND, source=self.url,
                          detail=f"transporte={self.transport} · {tam}")

    # ── montagem do comando ───────────────────────────────────────
    def _comando(self) -> List[str]:
        cmd = [
            "ffmpeg",
            "-hide_banner", "-loglevel", "warning",
            # baixa latência: não acumular buffer antes de entregar
            "-fflags", "nobuffer",
            "-flags", "low_delay",
            "-probesize", "32",
            "-analyzeduration", "0",
            *_args_transporte(self.transport),
            "-timeout", str(self.timeout_us),
            "-i", self.url,
            "-an", "-sn",              # sem áudio, sem legenda
        ]

        if self._forcado:
            # Resolução veio na mão. Forçamos a saída nesse tamanho com o
            # filtro scale: assim o número de bytes por frame bate com o
            # que o read() espera, mesmo que o chute esteja errado. Sem
            # isto, um valor incorreto desalinha os bytes e o vídeo sai
            # embaralhado / na diagonal.
            cmd += ["-vf", f"scale={self.width}:{self.height}"]

        cmd += [
            "-f", "rawvideo",
            "-pix_fmt", "bgr24",       # o formato que o OpenCV/numpy espera
            "-",
        ]
        return cmd

    def _drenar_stderr(self) -> None:
        """
        O stderr do ffmpeg PRECISA ser lido continuamente. Se o pipe
        encher, o ffmpeg trava — e o vídeo congela sem erro aparente.
        """
        proc = self._proc
        if proc is None or proc.stderr is None:
            return
        for linha in iter(proc.stderr.readline, b""):
            texto = linha.decode("utf-8", "replace").strip()
            if texto:
                self._stderr_tail.append(texto)
                log.debug("ffmpeg: %s", texto)

    # ── ciclo de vida ─────────────────────────────────────────────
    def connect(self) -> bool:
        self._status.connect_attempts += 1

        if not ffmpeg_disponivel():
            self._status.connected = False
            self._status.last_error = (
                "ffmpeg não encontrado no PATH. Instale: "
                "Arch `sudo pacman -S ffmpeg` · Ubuntu `sudo apt install ffmpeg`"
            )
            self._status.fatal = True      # instalar pacote nao e retentavel
            log.error(self._status.last_error)
            return False

        if not self.width or not self.height:
            log.info("Descobrindo a resolução do stream (ffprobe)...")
            dims = descobrir_resolucao(self.url, self.transport)
            if dims is None:
                self._status.connected = False
                self._status.last_error = (
                    "não consegui descobrir a resolução do stream. Informe "
                    "na mão, ex.: --width 1280 --height 720 (qualquer valor "
                    "serve: o ffmpeg redimensiona para o tamanho pedido)"
                )
                self._status.fatal = True  # configuracao, nao rede
                log.error(self._status.last_error)
                return False
            self.width, self.height = dims
            log.info("Resolução detectada: %sx%s", self.width, self.height)

        log.info("Abrindo stream via ffmpeg do sistema (transporte=%s)", self.transport)
        try:
            self._proc = subprocess.Popen(
                self._comando(),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=0,
            )
        except OSError as exc:
            self._status.connected = False
            self._status.last_error = f"não consegui iniciar o ffmpeg: {exc}"
            return False

        self._stderr_thread = threading.Thread(
            target=self._drenar_stderr, name="ffmpeg-stderr", daemon=True
        )
        self._stderr_thread.start()

        self._status.connected = True
        self._status.last_error = ""
        self._status.extra.update(largura=self.width, altura=self.height)
        return True

    def _ler_exato(self, n: int) -> Optional[bytes]:
        """Lê exatamente n bytes. Pipe entrega em pedaços, não de uma vez."""
        proc = self._proc
        if proc is None or proc.stdout is None:
            return None

        pedacos: List[bytes] = []
        faltam = n
        while faltam > 0:
            bloco = proc.stdout.read(faltam)
            if not bloco:          # EOF: o ffmpeg morreu
                return None
            pedacos.append(bloco)
            faltam -= len(bloco)
        return b"".join(pedacos)

    def read(self) -> Tuple[bool, Optional[Any]]:
        if self._proc is None or not self.width or not self.height:
            return False, None

        bytes_por_frame = self.width * self.height * 3
        cru = self._ler_exato(bytes_por_frame)

        if cru is None:
            motivo = "; ".join(list(self._stderr_tail)[-2:]) or "ffmpeg encerrou"
            self._mark_failure(motivo)
            self._status.connected = False
            return False, None

        self._mark_frame()

        # Com numpy saudável entregamos ndarray, que é o que o QR Engine
        # e o OpenCV esperam. Sem ele, entregamos os bytes crus: o vídeo
        # continua chegando e o marco 1 segue verificável.
        if numpy_utilizavel():
            import numpy as np

            return True, np.frombuffer(cru, dtype=np.uint8).reshape(
                (self.height, self.width, 3)
            )

        return True, RawFrame(cru, self.width, self.height)

    def disconnect(self) -> None:
        proc = self._proc
        if proc is not None:
            try:
                proc.terminate()
                try:
                    proc.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait(timeout=2)
            except Exception as exc:  # noqa: BLE001
                log.debug("erro ao encerrar ffmpeg: %s", exc)
            finally:
                for fluxo in (proc.stdout, proc.stderr):
                    try:
                        if fluxo:
                            fluxo.close()
                    except Exception:  # noqa: BLE001
                        pass
            self._proc = None
        self._status.connected = False


class FlowUfoFfmpegDriver(FfmpegPipeDriver):
    """FLOW-UFO usando o ffmpeg do sistema em vez do OpenCV."""

    NAME = "FLOW-UFO (ffmpeg)"
    KIND = "drone-ffmpeg"

    def __init__(self, ip: str = "192.168.1.1", port: int = 7070,
                 path: str = "/webcam", **kwargs: object) -> None:
        caminho = path if path.startswith("/") else f"/{path}"
        super().__init__(f"rtsp://{ip}:{port}{caminho}", **kwargs)  # type: ignore[arg-type]
        self.ip, self.port = ip, port
