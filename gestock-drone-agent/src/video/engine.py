"""
engine.py — VideoEngine: mantém o stream vivo e sempre no PRESENTE.

Resolve dois problemas que aparecem assim que se sai do laboratório:

1) LATÊNCIA ACUMULADA
   O backend FFmpeg do OpenCV enfileira frames. Se o consumidor for
   mais lento que o stream, você lê o frame N enquanto o drone já
   está no N+30 — ou seja, lê o passado. Com o drone se movendo, o
   QR lido pode ser de uma prateleira que já ficou para trás.

   Solução: uma thread lê o mais rápido possível e guarda APENAS o
   último frame. Frame antigo é descartado, não enfileirado. O
   consumidor sempre pega o mais recente disponível.

2) QUEDA DE CONEXÃO
   Wi-Fi de drone cai. A thread detecta que faz tempo que nenhum
   frame bom chega ("stall") e reconecta sozinha, com backoff
   exponencial para não martelar o equipamento.

Perder frames é aceitável: para ler QR não precisamos de todos.
    frame 1 perdido · 2 ok · 3 ok · 4 perdido · 5 QR detectado ✓
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Optional, Tuple

from ..core.states import AgentState, StateMachine
from ..drivers.base import BaseDroneDriver

log = logging.getLogger(__name__)


@dataclass
class EngineStats:
    """Números que o operador e o health monitor enxergam."""

    frames_recebidos: int = 0
    frames_entregues: int = 0
    frames_descartados: int = 0
    falhas_leitura: int = 0
    reconexoes: int = 0
    iniciado_em: float = field(default_factory=time.monotonic)
    ultimo_frame_em: Optional[float] = None
    _janela: list = field(default_factory=list)

    @property
    def uptime(self) -> float:
        return time.monotonic() - self.iniciado_em

    @property
    def fps(self) -> float:
        """FPS medido nos últimos ~2 segundos (não média desde o início)."""
        agora = time.monotonic()
        self._janela = [t for t in self._janela if agora - t <= 2.0]
        return round(len(self._janela) / 2.0, 1)

    @property
    def idade_do_frame(self) -> Optional[float]:
        if self.ultimo_frame_em is None:
            return None
        return time.monotonic() - self.ultimo_frame_em

    def marcar_frame(self) -> None:
        agora = time.monotonic()
        self.frames_recebidos += 1
        self.ultimo_frame_em = agora
        self._janela.append(agora)

    def resumo(self) -> dict:
        return {
            "fps": self.fps,
            "recebidos": self.frames_recebidos,
            "entregues": self.frames_entregues,
            "descartados": self.frames_descartados,
            "falhas": self.falhas_leitura,
            "reconexoes": self.reconexoes,
            "uptime_s": round(self.uptime, 1),
            "idade_frame_s": (round(self.idade_do_frame, 2)
                              if self.idade_do_frame is not None else None),
        }


class VideoEngine:
    """
    Envolve um driver e entrega sempre o frame mais recente.

        engine = VideoEngine(FlowUfoDriver())
        engine.start()
        ok, frame = engine.latest()
    """

    def __init__(
        self,
        driver: BaseDroneDriver,
        *,
        stall_timeout: float = 5.0,
        max_reconnects: int = 0,          # 0 = tentar para sempre
        backoff_inicial: float = 1.0,
        backoff_maximo: float = 15.0,
        machine: Optional[StateMachine] = None,
    ) -> None:
        self.driver = driver
        self.stall_timeout = stall_timeout
        self.max_reconnects = max_reconnects
        self.backoff_inicial = backoff_inicial
        self.backoff_maximo = backoff_maximo
        self.machine = machine or StateMachine()

        self.stats = EngineStats()

        self._frame: Optional[Any] = None
        self._frame_id = 0
        self._ultimo_entregue = -1
        self._lock = threading.Lock()
        self._parar = threading.Event()
        self._thread: Optional[threading.Thread] = None

    # ── ciclo de vida ─────────────────────────────────────────────
    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._parar.clear()
        self._thread = threading.Thread(
            target=self._loop, name="video-engine", daemon=True
        )
        self._thread.start()

    def stop(self, timeout: float = 3.0) -> None:
        self._parar.set()
        if self._thread:
            self._thread.join(timeout=timeout)
        self.driver.disconnect()
        self.machine.to(AgentState.OFFLINE, "encerrado pelo usuário")

    # ── consumo ───────────────────────────────────────────────────
    def latest(self) -> Tuple[bool, Optional[Any]]:
        """Último frame disponível. Não bloqueia."""
        with self._lock:
            if self._frame is None:
                return False, None
            self.stats.frames_entregues += 1
            self._ultimo_entregue = self._frame_id
            return True, self._frame

    def latest_novo(self) -> Tuple[bool, Optional[Any]]:
        """
        Só devolve se for um frame INÉDITO desde a última chamada.
        É isto que o QR Engine vai usar: reprocessar o mesmo frame
        é desperdício de CPU.
        """
        with self._lock:
            if self._frame is None or self._frame_id == self._ultimo_entregue:
                return False, None
            self.stats.frames_entregues += 1
            self._ultimo_entregue = self._frame_id
            return True, self._frame

    @property
    def conectado(self) -> bool:
        return self.driver.is_connected

    # ── laço interno ──────────────────────────────────────────────
    def _conectar_com_backoff(self) -> bool:
        """Tenta conectar até conseguir (ou até estourar o limite)."""
        espera = self.backoff_inicial
        tentativa = 0

        while not self._parar.is_set():
            tentativa += 1
            self.machine.to(
                AgentState.CONECTANDO_STREAM,
                f"tentativa {tentativa}",
            )
            if self.driver.connect():
                self.machine.to(AgentState.STREAM_ATIVO, "stream aberto")
                return True

            # Erro de configuracao (falta ffmpeg, resolucao desconhecida):
            # insistir nao conserta. Falha na hora, com a mensagem util.
            if getattr(self.driver.status, "fatal", False):
                self.machine.to(
                    AgentState.ERRO,
                    self.driver.status.last_error or "erro de configuracao",
                )
                return False

            if self.max_reconnects and tentativa >= self.max_reconnects:
                self.machine.to(
                    AgentState.ERRO,
                    f"desisti após {tentativa} tentativas: {self.driver.status.last_error}",
                )
                return False

            self.machine.to(
                AgentState.RECONECTANDO,
                f"nova tentativa em {espera:.0f}s — {self.driver.status.last_error}",
            )
            # Espera interrompível: parar() não fica preso no sleep
            if self._parar.wait(timeout=espera):
                return False
            espera = min(espera * 2, self.backoff_maximo)

        return False

    def _loop(self) -> None:
        self.machine.to(AgentState.PROCURANDO_DRONE, str(self.driver.describe()))

        if not self._conectar_com_backoff():
            return

        ultimo_bom = time.monotonic()

        while not self._parar.is_set():
            ok, frame = self.driver.read()

            if ok and frame is not None:
                ultimo_bom = time.monotonic()
                self.stats.marcar_frame()
                with self._lock:
                    # Havia frame não consumido? Então ele morreu aqui.
                    # É exatamente isso que segura a latência baixa.
                    if self._frame is not None and self._frame_id != self._ultimo_entregue:
                        self.stats.frames_descartados += 1
                    self._frame = frame
                    self._frame_id += 1
                continue

            self.stats.falhas_leitura += 1

            # Frame solto perdido é normal. O que não é normal é ficar
            # MUITO tempo sem nenhum frame bom: aí a conexão morreu.
            if time.monotonic() - ultimo_bom > self.stall_timeout:
                self.machine.to(
                    AgentState.CONEXAO_PERDIDA,
                    f"{self.stall_timeout:.0f}s sem frame válido",
                )
                self.stats.reconexoes += 1
                self.driver.disconnect()
                if not self._conectar_com_backoff():
                    return
                ultimo_bom = time.monotonic()
            else:
                # Alívio para a CPU enquanto o stream se recupera
                time.sleep(0.005)

    # ── context manager ───────────────────────────────────────────
    def __enter__(self) -> "VideoEngine":
        self.start()
        return self

    def __exit__(self, *_exc: object) -> None:
        self.stop()
