"""
Testes do marco 1 — rodam em qualquer máquina, sem drone e sem câmera.

    python -m pytest tests -q          (se tiver pytest)
    python tests/test_engine.py        (sem pytest, roda direto)

O que precisa ficar provado aqui:

  1. O VideoEngine entrega frames.
  2. Ele SEMPRE entrega o mais recente (latência não acumula).
  3. Ele reconecta sozinho quando a fonte cai.
  4. Ele desiste e vai para ERRO quando a fonte não volta.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path
from typing import Any, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.core.states import AgentState, StateMachine  # noqa: E402
from src.drivers.base import BaseDroneDriver, DriverInfo  # noqa: E402
from src.video.engine import VideoEngine  # noqa: E402


class DriverInstavel(BaseDroneDriver):
    """
    Fonte que morre de propósito após `morrer_apos` frames e volta a
    funcionar depois de `reviver_apos` reconexões. Simula um Wi-Fi de
    drone caindo.
    """

    def __init__(self, morrer_apos: int = 10, reviver_apos: int = 1,
                 nunca_reviver: bool = False, fps: float = 200.0) -> None:
        super().__init__()
        self.morrer_apos = morrer_apos
        self.reviver_apos = reviver_apos
        self.nunca_reviver = nunca_reviver
        self.fps = fps            # fonte real e limitada por FPS
        self.conexoes = 0
        self._desde_conexao = 0
        self._proximo = 0.0

    def describe(self) -> DriverInfo:
        return DriverInfo(name="Instável", kind="teste", source="memória")

    def connect(self) -> bool:
        self.conexoes += 1
        if self.nunca_reviver and self.conexoes > 1:
            self._status.connected = False
            self._status.last_error = "fonte morta de propósito"
            return False
        if self.conexoes > 1 and self.conexoes <= self.reviver_apos:
            self._status.connected = False
            self._status.last_error = "ainda fora do ar"
            return False
        self._desde_conexao = 0
        self._status.connected = True
        return True

    def read(self) -> Tuple[bool, Optional[Any]]:
        if not self._status.connected:
            return False, None
        if self._desde_conexao >= self.morrer_apos:
            self._mark_failure("fonte caiu")
            return False, None

        # Cadencia: segura o ritmo como um stream de verdade
        if self.fps:
            agora = time.monotonic()
            if self._proximo and agora < self._proximo:
                time.sleep(self._proximo - agora)
            self._proximo = max(agora, self._proximo) + 1.0 / self.fps

        self._desde_conexao += 1
        self._mark_frame()
        # "frame" simbólico: o engine não interpreta conteúdo
        return True, ("frame", self._status.frames_read)

    def disconnect(self) -> None:
        self._status.connected = False


def _esperar(condicao, timeout: float = 10.0, intervalo: float = 0.05) -> bool:
    fim = time.monotonic() + timeout
    while time.monotonic() < fim:
        if condicao():
            return True
        time.sleep(intervalo)
    return False


def test_entrega_frames() -> None:
    engine = VideoEngine(DriverInstavel(morrer_apos=10**9, fps=200), stall_timeout=1.0)
    engine.start()
    try:
        assert _esperar(lambda: engine.stats.frames_recebidos > 20), "não recebeu frames"
        ok, frame = engine.latest()
        assert ok and frame is not None, "latest() não devolveu frame"
    finally:
        engine.stop()
    print("ok  entrega frames")


def test_sempre_o_mais_recente() -> None:
    """
    O consumidor lento NÃO pode receber frames antigos empilhados.
    Depois de uma pausa, o frame entregue tem que ser recente.
    """
    engine = VideoEngine(DriverInstavel(morrer_apos=10**9, fps=200), stall_timeout=1.0)
    engine.start()
    try:
        assert _esperar(lambda: engine.stats.frames_recebidos > 10)
        _, primeiro = engine.latest()
        n_primeiro = primeiro[1]

        time.sleep(0.4)  # consumidor "travado"

        _, depois = engine.latest()
        n_depois = depois[1]
        produzidos = engine.stats.frames_recebidos

        # O frame entregue deve estar colado no último produzido,
        # não 0.4s atrás na fila.
        atraso = produzidos - n_depois
        assert n_depois > n_primeiro, "frame não avançou"
        assert atraso <= 2, f"latência acumulou: {atraso} frames atrás"
        assert engine.stats.frames_descartados > 0, "nada foi descartado"
    finally:
        engine.stop()
    print(f"ok  sempre o mais recente (atraso={atraso} frame(s))")


def test_reconecta_sozinho() -> None:
    driver = DriverInstavel(morrer_apos=15, reviver_apos=1)
    machine = StateMachine()
    engine = VideoEngine(driver, stall_timeout=0.5, backoff_inicial=0.1, machine=machine)
    engine.start()
    try:
        assert _esperar(lambda: engine.stats.reconexoes >= 1, timeout=10), "não reconectou"
        assert _esperar(lambda: machine.state is AgentState.STREAM_ATIVO, timeout=10), \
            f"não voltou a STREAM_ATIVO (ficou em {machine.state})"
        assert driver.conexoes >= 2, "não houve segunda conexão"
    finally:
        engine.stop()

    estados = [t.para for t in machine.historico()]
    assert AgentState.CONEXAO_PERDIDA in estados, "não sinalizou CONEXAO_PERDIDA"
    print(f"ok  reconecta sozinho (conexões={driver.conexoes}, "
          f"reconexões={engine.stats.reconexoes})")


def test_desiste_e_sinaliza_erro() -> None:
    driver = DriverInstavel(morrer_apos=5, nunca_reviver=True)
    machine = StateMachine()
    engine = VideoEngine(driver, stall_timeout=0.3, max_reconnects=2,
                         backoff_inicial=0.1, machine=machine)
    engine.start()
    try:
        assert _esperar(lambda: machine.state is AgentState.ERRO, timeout=10), \
            f"não foi para ERRO (ficou em {machine.state})"
    finally:
        engine.stop()
    print("ok  desiste e sinaliza ERRO")


def test_maquina_de_estados_ignora_repeticao() -> None:
    m = StateMachine()
    assert m.to(AgentState.STREAM_ATIVO, "x") is not None
    assert m.to(AgentState.STREAM_ATIVO, "x") is None, "repetição gerou transição"
    print("ok  máquina de estados ignora repetição")


def test_opencv_decodifica_de_verdade() -> None:
    """
    Exercita o cv2 DE VERDADE.

    Este teste existe por causa de um bug real: o opencv-python 5.0.x
    morria com SIGILL ("illegal hardware instruction") ao inicializar o
    backend de vídeo. Os testes passavam mesmo assim, porque o driver
    de teste é Python puro e nunca tocava no cv2 — o problema só
    aparecia com o drone na frente.

    O SyntheticDriver usa cv2 para montar o frame, então se o OpenCV
    estiver quebrado nesta máquina, ISTO falha aqui e não na hora ruim.
    """
    from src.drivers.local_sources import SyntheticDriver

    driver = SyntheticDriver(width=320, height=240, fps=60)
    engine = VideoEngine(driver, stall_timeout=2.0)
    engine.start()
    try:
        assert _esperar(lambda: engine.stats.frames_recebidos > 5, timeout=8),             "OpenCV não produziu frames — rode: python -m src.doctor"
        ok, frame = engine.latest()
        assert ok and frame is not None
        assert frame.shape == (240, 320, 3), f"formato inesperado: {frame.shape}"
    finally:
        engine.stop()
    print(f"ok  OpenCV decodifica de verdade (frame {frame.shape})")


def test_driver_ffmpeg_falha_com_mensagem_util() -> None:
    """
    Sem ffmpeg no sistema, o driver precisa dizer o que fazer —
    e não estourar exceção nem travar.
    """
    from src.drivers.ffmpeg_pipe import FfmpegPipeDriver, ffmpeg_disponivel

    driver = FfmpegPipeDriver("rtsp://192.0.2.1:7070/webcam")
    if ffmpeg_disponivel():
        print("ok  ffmpeg presente (teste de ausência pulado)")
        return

    assert driver.connect() is False, "deveria falhar sem ffmpeg"
    assert "ffmpeg" in driver.status.last_error.lower(),         f"mensagem pouco útil: {driver.status.last_error}"
    assert "instale" in driver.status.last_error.lower(),         "a mensagem não diz como resolver"
    print("ok  driver ffmpeg falha com mensagem útil")


def test_todos_os_drivers_cumprem_o_contrato() -> None:
    """Nenhum driver registrado pode esquecer um método do contrato."""
    from src.drivers import REGISTRY
    from src.drivers.base import BaseDroneDriver

    for nome, fabrica in REGISTRY.items():
        assert issubclass(fabrica, BaseDroneDriver), f"{nome} não herda do contrato"
        for metodo in ("describe", "connect", "read", "disconnect"):
            assert callable(getattr(fabrica, metodo, None)),                 f"{nome} não implementa {metodo}()"
    print(f"ok  {len(REGISTRY)} drivers cumprem o contrato")



if __name__ == "__main__":
    falhas = 0
    for nome, fn in list(globals().items()):
        if nome.startswith("test_") and callable(fn):
            try:
                fn()
            except AssertionError as exc:
                falhas += 1
                print(f"FALHOU  {nome}: {exc}")
            except Exception as exc:  # noqa: BLE001
                falhas += 1
                print(f"ERRO    {nome}: {exc!r}")
    print("\n" + ("todos os testes passaram" if not falhas else f"{falhas} teste(s) falharam"))
    raise SystemExit(1 if falhas else 0)
