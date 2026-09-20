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
  6. Os alvos (a mira) saem com posição, tamanho do quadro e prazo de
     validade — e somem quando o código sai de cena.
  7. As vistas de diagnóstico são servidas e recusam nome inválido.
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
        assert status == 200 and b"/video" in corpo

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


# ── 3. alvos: a mira da tela ─────────────────────────────────────
def test_alvo_sai_com_o_tamanho_do_quadro():
    """
    Sem as dimensões, a tela não consegue converter as coordenadas do
    Agent para os pixels em que o vídeo é realmente exibido — a mira
    cairia em qualquer lugar menos em cima do código.
    """
    try:
        import numpy as np
    except Exception as exc:  # noqa: BLE001
        print(f"      (pulado: sem numpy — {exc})")
        return

    e = EstadoCompartilhado()
    e.publicar_frame(np.zeros((360, 640, 3), dtype=np.uint8))
    e.publicar_alvos([{"codigo": "A", "pontos": [[1, 2], [3, 4]],
                       "estrategia": "OTSU", "registrado": False}])

    snap = e.snapshot()
    assert snap["quadro"] == {"largura": 640, "altura": 360}
    assert snap["alvos"][0]["pontos"] == [[1, 2], [3, 4]]


def test_alvo_vence_quando_o_codigo_sai_de_cena():
    """Sem prazo, a mira ficaria parada no ar depois que o drone virasse."""
    import src.server as servidor

    e = EstadoCompartilhado()
    e.publicar_alvos([{"codigo": "A", "pontos": [[0, 0]]}])
    assert e.snapshot()["alvos"], "o alvo recém-publicado deveria valer"

    # Envelhece o alvo sem esperar de verdade.
    e._alvos_em -= servidor.VALIDADE_ALVO_S + 0.1
    assert e.snapshot()["alvos"] == [], "alvo velho deveria ter sumido"


def test_sem_alvo_nenhum_a_lista_vem_vazia():
    e = EstadoCompartilhado()
    assert e.snapshot()["alvos"] == []


# ── 4. vistas de diagnóstico ─────────────────────────────────────
def test_estado_anuncia_as_vistas_disponiveis():
    """A tela monta o seletor a partir daqui, em vez de repetir a lista."""
    from src.vision.pipeline import ORDEM_PADRAO

    e = EstadoCompartilhado()
    vistas = e.snapshot()["vistas"]
    ids = [v["id"] for v in vistas]

    assert ids == ["ORIGINAL"] + list(ORDEM_PADRAO)
    assert all(v["rotulo"] and v["rotulo"] != v["id"] for v in vistas), \
        "cada vista precisa de um nome legível para o operador"


def test_pedir_vista_chega_ao_laco_do_agent():
    """
    O servidor NÃO mexe no motor: ele só registra o pedido, e o laço do
    Agent aplica. Mexer no motor de outra thread seria corrida.
    """
    try:
        import numpy as np
    except Exception as exc:  # noqa: BLE001
        print(f"      (pulado: sem numpy — {exc})")
        return

    e = EstadoCompartilhado()
    s = ServidorLocal(e, porta=8806)
    try:
        porta = s.iniciar()
        assert e.vista_pedida is None

        # O stream fica aberto, então lemos só o início e fechamos.
        req = urllib.request.urlopen(
            f"http://127.0.0.1:{porta}/video?vista=OTSU", timeout=5)
        time.sleep(0.2)
        req.close()

        assert e.vista_pedida == "OTSU"
    finally:
        s.parar()


def test_vista_original_nao_faz_o_motor_trabalhar():
    """Ver a câmera crua não pode custar processamento nenhum."""
    e = EstadoCompartilhado()
    s = ServidorLocal(e, porta=8807)
    try:
        porta = s.iniciar()
        req = urllib.request.urlopen(
            f"http://127.0.0.1:{porta}/video?vista=ORIGINAL", timeout=5)
        time.sleep(0.2)
        req.close()
        assert e.vista_pedida is None
    finally:
        s.parar()


def test_vista_desconhecida_e_recusada():
    e = EstadoCompartilhado()
    s = ServidorLocal(e, porta=8808)
    try:
        porta = s.iniciar()
        try:
            _pegar(f"http://127.0.0.1:{porta}/video?vista=SEPIA")
            raise AssertionError("deveria recusar vista inexistente")
        except urllib.error.HTTPError as erro:
            assert erro.code == 400
        assert e.vista_pedida is None
    finally:
        s.parar()


def test_vista_so_e_servida_quando_corresponde_ao_pedido():
    """
    O caso que quebrava: a câmera publica a 25 quadros por segundo e o
    leitor analisa a 12. Ao trocar de tratamento, o stream continuava
    entregando a vista ANTERIOR por um instante — quem pedia "preto e
    branco" via, por um momento, a binarizada.
    """
    e = EstadoCompartilhado()
    e.publicar_frame("camera-1")
    e.publicar_vista("imagem-otsu", "OTSU")

    assert e.frame_atual()[0] == "camera-1"
    assert e.frame_atual(vista="OTSU")[0] == "imagem-otsu"

    # Operador troca para CINZA: nada é servido até o motor produzir.
    assert e.frame_atual(vista="CINZA")[0] is None,         "não pode entregar a vista antiga com o nome da nova"

    e.publicar_vista("imagem-cinza", "CINZA")
    assert e.frame_atual(vista="CINZA")[0] == "imagem-cinza"


def test_vista_tem_contador_proprio():
    """
    Com um contador só, cada quadro da câmera faria o stream da vista
    reenviar a mesma imagem tratada — gastando CPU e banda à toa.
    """
    e = EstadoCompartilhado()
    e.publicar_vista("t1", "OTSU")
    _, v1 = e.frame_atual(vista="OTSU")

    e.publicar_frame("c1")
    e.publicar_frame("c2")
    _, v2 = e.frame_atual(vista="OTSU")
    assert v1 == v2, "quadro da câmera não pode avançar o contador da vista"

    e.publicar_vista("t2", "OTSU")
    _, v3 = e.frame_atual(vista="OTSU")
    assert v3 > v2


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
