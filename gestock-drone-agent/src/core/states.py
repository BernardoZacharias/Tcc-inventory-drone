"""
states.py — máquina de estados do Agent.

O operador precisa saber, sem ambiguidade, em que pé está a operação.
"Não está funcionando" é um relato inútil; "RECONECTANDO há 12s porque
o stream parou" é acionável.

    OFFLINE → PROCURANDO_DRONE → CONECTANDO_STREAM → STREAM_ATIVO
                                                         ↓
                                                  LEITURA_ATIVA
    Em falha:
    STREAM_ATIVO → CONEXAO_PERDIDA → RECONECTANDO → STREAM_ATIVO
                                          ↓ (esgotou)
                                        ERRO
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from enum import Enum
from typing import Callable, List, Optional

log = logging.getLogger(__name__)


class AgentState(str, Enum):
    OFFLINE = "OFFLINE"
    PROCURANDO_DRONE = "PROCURANDO_DRONE"
    DRONE_ENCONTRADO = "DRONE_ENCONTRADO"
    CONECTANDO_STREAM = "CONECTANDO_STREAM"
    STREAM_ATIVO = "STREAM_ATIVO"
    LEITURA_ATIVA = "LEITURA_ATIVA"
    CONEXAO_PERDIDA = "CONEXAO_PERDIDA"
    RECONECTANDO = "RECONECTANDO"
    ERRO = "ERRO"

    @property
    def saudavel(self) -> bool:
        return self in (AgentState.STREAM_ATIVO, AgentState.LEITURA_ATIVA)

    @property
    def rotulo(self) -> str:
        return {
            AgentState.OFFLINE: "Desligado",
            AgentState.PROCURANDO_DRONE: "Procurando o drone",
            AgentState.DRONE_ENCONTRADO: "Drone encontrado",
            AgentState.CONECTANDO_STREAM: "Conectando ao vídeo",
            AgentState.STREAM_ATIVO: "Stream ativo",
            AgentState.LEITURA_ATIVA: "Lendo QR Codes",
            AgentState.CONEXAO_PERDIDA: "Conexão perdida",
            AgentState.RECONECTANDO: "Reconectando",
            AgentState.ERRO: "Erro",
        }[self]


@dataclass(frozen=True)
class Transition:
    de: AgentState
    para: AgentState
    motivo: str
    em: float


class StateMachine:
    """
    Guarda o estado atual e o histórico. Thread-safe, porque o
    VideoEngine escreve de uma thread e a UI lê de outra.
    """

    def __init__(self, inicial: AgentState = AgentState.OFFLINE, historico: int = 50) -> None:
        self._estado = inicial
        self._lock = threading.Lock()
        self._desde = time.monotonic()
        self._limite = historico
        self._historico: List[Transition] = []
        self._ouvintes: List[Callable[[Transition], None]] = []

    @property
    def state(self) -> AgentState:
        with self._lock:
            return self._estado

    @property
    def segundos_no_estado(self) -> float:
        with self._lock:
            return time.monotonic() - self._desde

    def on_change(self, callback: Callable[[Transition], None]) -> None:
        """Registra ouvinte — será a ponte para o WebSocket mais tarde."""
        self._ouvintes.append(callback)

    def to(self, novo: AgentState, motivo: str = "") -> Optional[Transition]:
        """Muda de estado. Repetir o mesmo estado não gera evento."""
        with self._lock:
            if novo == self._estado:
                return None
            transicao = Transition(self._estado, novo, motivo, time.monotonic())
            self._estado = novo
            self._desde = transicao.em
            self._historico.append(transicao)
            del self._historico[:-self._limite]

        nivel = logging.ERROR if novo is AgentState.ERRO else logging.INFO
        log.log(nivel, "[%s] %s%s", novo.value, novo.rotulo,
                f" — {motivo}" if motivo else "")

        for ouvinte in self._ouvintes:
            try:
                ouvinte(transicao)
            except Exception as exc:  # noqa: BLE001 - ouvinte não derruba o Agent
                log.debug("ouvinte de estado falhou: %s", exc)
        return transicao

    def historico(self) -> List[Transition]:
        with self._lock:
            return list(self._historico)
