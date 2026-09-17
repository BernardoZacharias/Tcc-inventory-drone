"""
Testes do servidor local — a ponte entre o Agent e a tela do aplicativo.

    python tests/test_servidor.py

O que precisa ficar provado aqui:

  1. Só escuta em 127.0.0.1. Em 0.0.0.0 qualquer um no mesmo Wi-Fi
     assistiria ao vídeo do estoque — é o teste mais importante.
  2. /estado devolve o que a tela consome, com a leitura mais NOVA
     primeiro (a tela mostra de cima para baixo).
  3. /video devolve MJPEG de verdade, com JPEG de verdade dentro.
  4. Porta ocupada não derruba o Agent: ele anda para a seguinte.
  5. O histórico de leituras não cresce sem limite.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.server import (  # noqa: E402
    LIMITE_LEITURAS, EstadoCompartilhado, ServidorLocal,
)


# ── dublês, no formato que o QrEngine entrega ────────────────────
@dataclass
class _Dados:
    produto_id: Optional[str] = "12345"
    nome_produto: Optional[str] = "Teclado Logitech"
    quantidade: Optional[int] = 50
    fragil: Optional[str] = "Não"
    local: Optional[str] = "Corredor A"
    estruturado: bool = True

    def resumo(self) -> str:
        return "Teclado Logitech | 50 un"


@dataclass
class _Leitura:
    codigo: str = "PRODUTO ID: 12345"
    dados: _Dados = None
    estrategia: str = "CLAHE"
    em: float = 0.0

    def __post_init__(self):
        if self.dados is None:
            self.dados = _Dados()


def _pegar(url: str, timeout: float = 5.0):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return r.status, r.read(), dict(r.headers)


# ── 1. estado compartilhado ──────────────────────────────────────
def test_frame_novo_muda_o_contador():
    """O stream só reenvia quando o número muda — é o que evita
    recomprimir e retransmitir um quadro que a tela já tem."""
    e = EstadoCompartilhado()
    assert e.frame_atual() == (None, 0)
    e.publicar_frame("quadro-a")
    _, n1 = e.frame_atual()
    e.publicar_frame("quadro-b")
    frame, n2 = e.frame_atual()
    assert frame == "quadro-b"
    assert n2 == n1 + 1


def test_leitura_mais_nova_vem_primeiro():
    e = EstadoCompartilhado()
    e.publicar_leitura(_Leitura(codigo="A"))
    e.publicar_leitura(_Leitura(codigo="B"))
    codigos = [l["codigo"] for l in e.snapshot()["leituras"]]
    assert codigos == ["B", "A"]


def test_historico_de_leituras_nao_cresce_sem_limite():
    """Um inventário longo não pode estourar a memória do Agent."""
    e = EstadoCompartilhado()
    for i in range(LIMITE_LEITURAS + 50):
        e.publicar_leitura(_Leitura(codigo=f"C{i}"))
    snap = e.snapshot()
    assert snap["total"] == LIMITE_LEITURAS
    assert snap["leituras"][0]["codigo"] == f"C{LIMITE_LEITURAS + 49}"


def test_snapshot_traz_o_que_a_tela_usa():
    e = EstadoCompartilhado()
    e.publicar_estado("LEITURA_ATIVA", "Lendo QR Codes",
                      {"fps": 25.0, "leituras": 1}, equipamento="FLOW-UFO")
    e.publicar_leitura(_Leitura())
    snap = e.snapshot()

    assert snap["estado"] == "LEITURA_ATIVA"
    assert snap["rotulo"] == "Lendo QR Codes"
    assert snap["equipamento"] == "FLOW-UFO"
    assert snap["metricas"]["fps"] == 25.0

    item = snap["leituras"][0]
    for campo in ("codigo", "resumo", "produto_id", "nome", "quantidade",
                  "fragil", "local", "estruturado", "estrategia", "em"):
        assert campo in item, f"a tela espera o campo {campo}"
    assert item["nome"] == "Teclado Logitech"


def test_metricas_sao_copia_e_nao_referencia():
    """Se o snapshot devolvesse a referência, o laço do Agent estaria
    alterando, de outra thread, o dicionário que está sendo serializado."""
    e = EstadoCompartilhado()
    metricas = {"fps": 10}
    e.publicar_estado("X", "x", metricas)
    snap = e.snapshot()
    metricas["fps"] = 999
    assert snap["metricas"]["fps"] == 10


# ── 2. servidor de verdade ───────────────────────────────────────
def test_servidor_escuta_so_na_propria_maquina():
    """
    O teste que mais importa: o vídeo do galpão não pode ir para a
    rede. Em 0.0.0.0, qualquer um no mesmo Wi-Fi assistiria.
    """
    e = EstadoCompartilhado()
    s = ServidorLocal(e, porta=8801)
    try:
        assert s.iniciar() is not None
        assert s._srv.server_address[0] == "127.0.0.1"
    finally:
        s.parar()


def test_rotas_respondem():
    e = EstadoCompartilhado()
    e.publicar_estado("STREAM_ATIVO", "Stream ativo", {"fps": 25.0})
    e.publicar_leitura(_Leitura())

    s = ServidorLocal(e, porta=8802)
    try:
        porta = s.iniciar()
        assert porta is not None
        base = f"http://127.0.0.1:{porta}"

        status, corpo, cab = _pegar(f"{base}/estado")
        assert status == 200
        assert cab.get("Access-Control-Allow-Origin") == "*", \
            "sem CORS o painel em file:// não consegue ler o estado"
        dados = json.loads(corpo)
        assert dados["estado"] == "STREAM_ATIVO"
        assert len(dados["leituras"]) == 1

        status, corpo, _ = _pegar(f"{base}/leituras")
        assert status == 200 and len(json.loads(corpo)) == 1

        status, corpo, _ = _pegar(f"{base}/")
        assert status == 200 and b"<img src=\"/video\"" in corpo

        try:
            _pegar(f"{base}/nao-existe")
            raise AssertionError("rota desconhecida deveria dar 404")
        except urllib.error.HTTPError as erro:
            assert erro.code == 404
    finally:
        s.parar()


def test_porta_ocupada_nao_derruba_o_agent():
    """Abrir o aplicativo duas vezes não pode virar 'Address already in use'."""
    e = EstadoCompartilhado()
    primeiro = ServidorLocal(e, porta=8803)
    segundo = ServidorLocal(e, porta=8803)
    try:
        p1 = primeiro.iniciar()
        p2 = segundo.iniciar()
        assert p1 == 8803
        assert p2 is not None and p2 != p1
    finally:
        primeiro.parar()
        segundo.parar()


def test_video_entrega_jpeg_de_verdade():
    """
    Sem isto, o servidor poderia estar servindo um multipart vazio e os
    outros testes continuariam verdes — a tela é que ficaria preta.
    """
    try:
        import cv2  # noqa: F401
        import numpy as np
    except Exception as exc:  # noqa: BLE001
        print(f"      (pulado: sem OpenCV/numpy — {exc})")
        return

    import threading

    e = EstadoCompartilhado()

    # O stream só emite quando o quadro MUDA. Publicar continuamente
    # reproduz a operação real e evita que a leitura fique pendurada
    # esperando um quadro que nunca viria.
    parar_publicacao = threading.Event()

    def publicar():
        while not parar_publicacao.is_set():
            e.publicar_frame(np.full((120, 160, 3), 128, dtype=np.uint8))
            time.sleep(0.02)

    threading.Thread(target=publicar, daemon=True).start()

    s = ServidorLocal(e, porta=8804, fps_video=30)
    try:
        porta = s.iniciar()
        with urllib.request.urlopen(f"http://127.0.0.1:{porta}/video",
                                    timeout=5) as r:
            assert "multipart/x-mixed-replace" in r.headers["Content-Type"]
            pedaco = r.read(2048)

        assert b"--quadro" in pedaco
        assert b"Content-Type: image/jpeg" in pedaco
        # ffd8ff é a assinatura de um JPEG. Sem ela, é multipart vazio.
        assert b"\xff\xd8\xff" in pedaco, "o corpo não é um JPEG"
    finally:
        parar_publicacao.set()
        s.parar()


def test_sem_frame_o_video_nao_quebra():
    """Conectar a tela antes do primeiro quadro é o caso normal."""
    e = EstadoCompartilhado()
    s = ServidorLocal(e, porta=8805)
    try:
        porta = s.iniciar()
        req = urllib.request.urlopen(f"http://127.0.0.1:{porta}/video",
                                     timeout=5)
        time.sleep(0.3)
        assert req.status == 200
        req.close()
    finally:
        s.parar()


if __name__ == "__main__":
    falhas = 0
    for nome, fn in sorted(globals().items()):
        if nome.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"  ok   {nome}")
            except Exception as exc:  # noqa: BLE001
                falhas += 1
                print(f"  FALHA {nome}: {type(exc).__name__}: {exc}")
    print("\nTodos passaram." if not falhas else f"\n{falhas} falha(s).")
    sys.exit(1 if falhas else 0)
