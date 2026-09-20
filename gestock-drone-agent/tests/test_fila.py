"""
Testes do marco 3 — a leitura não se perde.

    python tests/test_fila.py

O que precisa ficar provado aqui, e é o problema central do projeto:

  1. A leitura é gravada no disco ANTES de qualquer tentativa de rede.
  2. Sem internet — o caso NORMAL, porque a Wi-Fi do drone não tem —
     ela continua na fila, com o motivo anotado.
  3. Quando a rede volta, a fila esvazia sozinha e em ordem.
  4. Falha de envio NUNCA descarta leitura, por mais que se repita.
  5. Fechar e reabrir o Agent não perde o que estava pendente.
"""

from __future__ import annotations

import json
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.cloud.enviador import Enviador  # noqa: E402
from src.storage.fila import FilaLocal  # noqa: E402

ETIQUETA = "PRODUTO ID: 12345 Nome: Teclado Logitech Quantidade: 50"


# ── uma API de mentira, que dá para ligar e desligar ─────────────
class ApiFalsa:
    """
    Simula a API — e, principalmente, simula ela FORA DO AR, que é o
    estado dela durante todo o voo na Wi-Fi do drone.
    """

    def __init__(self):
        self.recebidas = []
        self.no_ar = True
        self.status = 201
        self._srv = None
        self.porta = None

    def __enter__(self):
        pai = self

        class Manipulador(BaseHTTPRequestHandler):
            def log_message(self, *a):  # noqa: A003
                return

            def do_POST(self):  # noqa: N802
                if not pai.no_ar:
                    self.send_response(503)
                    self.end_headers()
                    return
                n = int(self.headers.get("Content-Length", 0))
                corpo = json.loads(self.rfile.read(n).decode("utf-8"))
                pai.recebidas.append(corpo)
                self.send_response(pai.status)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"success":true}')

        for porta in range(8900, 8930):
            try:
                self._srv = ThreadingHTTPServer(("127.0.0.1", porta), Manipulador)
                self.porta = porta
                break
            except OSError:
                continue

        self._srv.daemon_threads = True
        threading.Thread(target=self._srv.serve_forever, daemon=True).start()
        return self

    def __exit__(self, *a):
        if self._srv:
            self._srv.shutdown()
            self._srv.server_close()

    @property
    def url(self):
        return f"http://127.0.0.1:{self.porta}/api"


def esperar(condicao, limite=8.0, passo=0.1):
    fim = time.time() + limite
    while time.time() < fim:
        if condicao():
            return True
        time.sleep(passo)
    return False


# ── 1. a fila em si ──────────────────────────────────────────────
def test_leitura_fica_salva_antes_de_qualquer_rede(tmp=None):
    """Nenhuma rede envolvida: gravar é a primeira coisa que acontece."""
    import tempfile

    with tempfile.TemporaryDirectory() as d:
        f = FilaLocal(Path(d) / "fila.db")
        f.enfileirar(ETIQUETA, empresa_id=1)
        r = f.resumo()
        assert r == {"total": 1, "pendentes": 1, "enviadas": 0, "ultimo_erro": None}
        f.fechar()


def test_pendentes_saem_na_ordem_em_que_foram_lidas():
    """O inventário tem que refletir a ordem do voo."""
    import tempfile

    with tempfile.TemporaryDirectory() as d:
        f = FilaLocal(Path(d) / "fila.db")
        for i in range(5):
            f.enfileirar(f"CODIGO-{i}", empresa_id=1)
        assert [p.codigo_qr for p in f.pendentes()] == [f"CODIGO-{i}" for i in range(5)]
        f.fechar()


def test_falha_nao_descarta_a_leitura():
    """
    O oposto de uma fila de mensagens comum, que joga fora depois de N
    tentativas. Aqui a leitura É o produto: perder um item do inventário
    é pior que tentar mil vezes.
    """
    import tempfile

    with tempfile.TemporaryDirectory() as d:
        f = FilaLocal(Path(d) / "fila.db")
        id_ = f.enfileirar(ETIQUETA, empresa_id=1)
        for _ in range(50):
            f.registrar_falha(id_, "sem conexão")

        r = f.resumo()
        assert r["pendentes"] == 1, "a leitura sumiu depois de muitas falhas"
        assert f.pendentes()[0].tentativas == 50
        assert "sem conexão" in r["ultimo_erro"]
        f.fechar()


def test_reabrir_o_agent_nao_perde_o_que_estava_pendente():
    """Fechar o aplicativo no meio do galpão não pode custar o inventário."""
    import tempfile

    with tempfile.TemporaryDirectory() as d:
        caminho = Path(d) / "fila.db"

        primeira = FilaLocal(caminho)
        primeira.enfileirar(ETIQUETA, empresa_id=1)
        primeira.enfileirar("OUTRO", empresa_id=1)
        primeira.fechar()

        segunda = FilaLocal(caminho)
        assert segunda.resumo()["pendentes"] == 2
        assert [p.codigo_qr for p in segunda.pendentes()] == [ETIQUETA, "OUTRO"]
        segunda.fechar()


def test_payload_e_o_que_a_api_espera():
    import tempfile

    with tempfile.TemporaryDirectory() as d:
        f = FilaLocal(Path(d) / "fila.db")
        f.enfileirar(ETIQUETA, empresa_id=7, operador_id=3, setor_id=2)
        p = f.pendentes()[0].como_payload()

        assert p == {
            "empresa_id": 7, "operador_id": 3, "setor_id": 2,
            "codigo_qr": ETIQUETA, "origem": "DRONE", "status": "lido",
        }
        f.fechar()


# ── 2. o envio ───────────────────────────────────────────────────
def test_envia_e_marca_como_enviada():
    import tempfile

    with tempfile.TemporaryDirectory() as d, ApiFalsa() as api:
        f = FilaLocal(Path(d) / "fila.db")
        f.enfileirar(ETIQUETA, empresa_id=1)

        e = Enviador(f, api.url)
        e.iniciar()
        try:
            assert esperar(lambda: f.resumo()["pendentes"] == 0), "não esvaziou"
            assert len(api.recebidas) == 1
            assert api.recebidas[0]["codigo_qr"] == ETIQUETA
            assert e.online is True
        finally:
            e.parar()
        f.fechar()


def test_sem_internet_a_leitura_espera_e_nao_some():
    """
    ESTE É O TESTE QUE IMPORTA. Na Wi-Fi do drone não existe internet, e
    é exatamente aí que o sistema faz o trabalho para o qual existe.
    """
    import tempfile

    with tempfile.TemporaryDirectory() as d, ApiFalsa() as api:
        api.no_ar = False

        f = FilaLocal(Path(d) / "fila.db")
        f.enfileirar(ETIQUETA, empresa_id=1)

        e = Enviador(f, api.url)
        e.iniciar()
        try:
            assert esperar(lambda: e.online is False, limite=5), "não percebeu que está offline"
            time.sleep(0.5)

            r = f.resumo()
            assert r["pendentes"] == 1, "a leitura foi perdida sem internet"
            assert r["enviadas"] == 0
            assert r["ultimo_erro"], "o motivo da falha não foi guardado"
            assert api.recebidas == []
        finally:
            e.parar()
        f.fechar()


def test_quando_a_rede_volta_a_fila_esvazia_sozinha():
    """O operador sai da Wi-Fi do drone e o inventário sobe sem ele pedir."""
    import tempfile

    with tempfile.TemporaryDirectory() as d, ApiFalsa() as api:
        api.no_ar = False

        f = FilaLocal(Path(d) / "fila.db")
        for i in range(4):
            f.enfileirar(f"CODIGO-{i}", empresa_id=1)

        e = Enviador(f, api.url)
        e.iniciar()
        try:
            assert esperar(lambda: e.online is False, limite=5)
            assert f.resumo()["pendentes"] == 4

            api.no_ar = True          # a internet volta
            e.acordar()

            assert esperar(lambda: f.resumo()["pendentes"] == 0, limite=12), \
                "a fila não esvaziou depois que a rede voltou"
            assert [r["codigo_qr"] for r in api.recebidas] == \
                [f"CODIGO-{i}" for i in range(4)], "subiu fora de ordem"
        finally:
            e.parar()
        f.fechar()


def test_resposta_de_erro_da_api_nao_descarta():
    """
    400 é culpa do dado, não da rede. Insistir não resolve, mas jogar
    fora perderia a leitura: ela fica com o motivo à vista.
    """
    import tempfile

    with tempfile.TemporaryDirectory() as d, ApiFalsa() as api:
        api.status = 400

        f = FilaLocal(Path(d) / "fila.db")
        f.enfileirar(ETIQUETA, empresa_id=1)

        e = Enviador(f, api.url)
        e.iniciar()
        try:
            assert esperar(lambda: bool(f.resumo()["ultimo_erro"]), limite=6)
            assert f.resumo()["pendentes"] == 1
        finally:
            e.parar()
        f.fechar()


def test_resumo_diz_a_tela_o_que_mostrar():
    import tempfile

    with tempfile.TemporaryDirectory() as d, ApiFalsa() as api:
        f = FilaLocal(Path(d) / "fila.db")
        f.enfileirar(ETIQUETA, empresa_id=1)
        e = Enviador(f, api.url)
        e.iniciar()
        try:
            assert esperar(lambda: f.resumo()["enviadas"] == 1)
            r = e.resumo()
            for campo in ("total", "pendentes", "enviadas", "online", "erro_envio"):
                assert campo in r, f"a tela espera o campo {campo}"
        finally:
            e.parar()
        f.fechar()


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
