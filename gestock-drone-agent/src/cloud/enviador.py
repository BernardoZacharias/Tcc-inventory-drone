"""
enviador.py — leva a fila para a API, quando e se a rede permitir.

Roda numa thread própria, separada do leitor. O laço que lê QR nunca
espera por rede: ele grava na fila e segue. Se o envio travasse o
laço, um Wi-Fi ruim viraria quadro perdido, e quadro perdido vira
etiqueta não lida.

COMO SE COMPORTA SEM INTERNET — que é o caso normal em operação:

O notebook está na Wi-Fi do drone, sem saída para o Supabase. Cada
tentativa falha, a leitura CONTINUA na fila e o intervalo entre
tentativas cresce (1s, 2s, 4s… até 30s), para não queimar CPU e
bateria tentando contra uma parede.

Quando a rede volta — o operador sai da Wi-Fi do drone, ou usa um
segundo adaptador — a fila é drenada em ordem, e o inventário inteiro
aparece no painel.

SOBRE DUPLICATAS: se a API gravar e a resposta se perder no caminho, a
leitura é reenviada e vira duas linhas. É o compromisso clássico desse
tipo de fila, e aqui ele é o lado certo de errar: um item repetido no
relatório é visível e corrigível; um item perdido não.
"""

from __future__ import annotations

import json
import logging
import threading
import urllib.error
import urllib.request
from typing import Optional

from ..storage.fila import FilaLocal

log = logging.getLogger(__name__)

ESPERA_INICIAL_S = 1.0
ESPERA_MAXIMA_S = 30.0
LOTE = 25


class Enviador:
    """Drena a fila para a API em segundo plano."""

    def __init__(self, fila: FilaLocal, api_url: str, *,
                 timeout: float = 8.0) -> None:
        self.fila = fila
        self.api_url = api_url.rstrip("/")
        self.timeout = timeout

        self._parar = threading.Event()
        # Acordado quando uma leitura nova entra na fila, para não
        # esperar o recuo inteiro com a rede já de volta.
        self._acordar = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._espera = ESPERA_INICIAL_S

        self.online: Optional[bool] = None   # None = ainda não se sabe
        self.ultimo_erro: Optional[str] = None
        self.enviadas = 0

    # ── ciclo de vida ─────────────────────────────────────────────
    def iniciar(self) -> None:
        if self._thread:
            return
        self._thread = threading.Thread(
            target=self._laco, name="enviador", daemon=True)
        self._thread.start()
        log.info("Envio para o estoque: %s", self.api_url)

    def parar(self, timeout: float = 3.0) -> None:
        self._parar.set()
        if self._thread:
            self._thread.join(timeout=timeout)
            self._thread = None

    def acordar(self) -> None:
        """
        Chamado quando uma leitura entra na fila.

        Sem isto, uma leitura feita logo depois de uma falha esperaria o
        recuo inteiro (até 30s) para ser tentada — mesmo com a rede já
        de volta.
        """
        self._espera = ESPERA_INICIAL_S
        self._acordar.set()

    # ── o laço ────────────────────────────────────────────────────
    def _laco(self) -> None:
        while not self._parar.is_set():
            pendentes = self.fila.pendentes(limite=LOTE)

            if not pendentes:
                # Nada a fazer: dorme curto e barato.
                self._acordar.wait(timeout=2.0)
                self._acordar.clear()
                continue

            progrediu = False
            for item in pendentes:
                if self._parar.is_set():
                    break

                ok, erro = self._enviar(item)
                if ok:
                    self.fila.marcar_enviada(item.id)
                    self.enviadas += 1
                    progrediu = True
                    self.online = True
                    self.ultimo_erro = None
                else:
                    self.fila.registrar_falha(item.id, erro)
                    self.online = False
                    self.ultimo_erro = erro
                    # Se a primeira falhou, as próximas vão falhar
                    # igual: é a rede, não o item. Recua e tenta depois.
                    break

            if progrediu:
                self._espera = ESPERA_INICIAL_S
            else:
                self._acordar.wait(timeout=self._espera)
                self._acordar.clear()
                self._espera = min(self._espera * 2, ESPERA_MAXIMA_S)

    def _enviar(self, item) -> tuple[bool, str]:
        corpo = json.dumps(item.como_payload()).encode("utf-8")
        req = urllib.request.Request(
            f"{self.api_url}/leituras",
            data=corpo,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                if 200 <= r.status < 300:
                    return True, ""
                return False, f"HTTP {r.status}"
        except urllib.error.HTTPError as e:
            # 4xx é culpa do dado, não da rede: insistir não resolve,
            # mas descartar perderia a leitura. Fica na fila com o
            # motivo à vista, para alguém decidir.
            detalhe = ""
            try:
                detalhe = json.loads(e.read().decode("utf-8")).get("message", "")
            except Exception:  # noqa: BLE001
                pass
            return False, f"HTTP {e.code} {detalhe}".strip()
        except urllib.error.URLError as e:
            return False, f"sem conexão ({e.reason})"
        except Exception as e:  # noqa: BLE001
            return False, str(e)

    # ── para a tela ───────────────────────────────────────────────
    def resumo(self) -> dict:
        r = self.fila.resumo()
        r["online"] = self.online
        r["erro_envio"] = self.ultimo_erro
        return r
