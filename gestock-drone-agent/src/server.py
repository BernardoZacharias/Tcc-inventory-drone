"""
server.py — expõe o que o Agent está vendo, para a janela do aplicativo.

O problema: o vídeo chega no Python, mas a tela é React dentro do
Electron. Passar quadro a quadro por IPC seria caro e ainda exigiria
converter tudo para base64.

A saída é um servidor HTTP local servindo **MJPEG**: o React mostra o
vídeo com uma `<img src="http://127.0.0.1:porta/video">` comum, e o
navegador decodifica sozinho. Sem codec, sem WebRTC, sem IPC de vídeo.

    GET /video      stream MJPEG (multipart/x-mixed-replace)
    GET /estado     JSON com estado, métricas e leituras
    GET /leituras   JSON só com as leituras
    GET /           página mínima para conferir fora do aplicativo

DUAS DECISÕES QUE NÃO SÃO DETALHE:

1. Escuta só em 127.0.0.1. O vídeo do galpão não vai para a rede: em
   0.0.0.0 qualquer um no mesmo Wi-Fi assistiria ao estoque.

2. O JPEG é gerado sob demanda, na thread de quem está assistindo. Sem
   ninguém olhando, não se gasta CPU comprimindo quadro que ninguém vê
   — e o laço principal, que é quem lê os QR, nunca espera pelo vídeo.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, List, Optional

log = logging.getLogger(__name__)

LIMITE_LEITURAS = 200


class _Servidor(ThreadingHTTPServer):
    """
    ThreadingHTTPServer com a posse da porta corrigida no Windows.

    O padrão do Python é `allow_reuse_address = True`, e o significado
    disso MUDA entre sistemas: no Unix apenas libera a porta em
    TIME_WAIT depois de um restart, mas no Windows permite que DOIS
    processos escutem a mesma porta ao mesmo tempo.

    O efeito prático seria pior que um erro: abrir o aplicativo duas
    vezes daria dois Agents "no ar" na porta 8765, a tela se conectaria
    a um deles ao acaso, e o vídeo pareceria congelar sem motivo.
    Aqui a segunda tentativa precisa falhar, para que o ServidorLocal
    ande para a porta seguinte.
    """

    allow_reuse_address = os.name != "nt"
    daemon_threads = True


class EstadoCompartilhado:
    """
    O que o laço principal escreve e o servidor lê.

    Protegido por lock porque são threads diferentes: o laço do Agent
    escreve, e cada cliente HTTP lê da sua própria thread.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._frame: Optional[Any] = None
        self._frame_n = 0
        self._leituras: List[dict] = []
        self._estado = "OFFLINE"
        self._rotulo = "Desligado"
        self._metricas: dict = {}
        self._equipamento = ""

    # ── escrita (laço do Agent) ───────────────────────────────────
    def publicar_frame(self, frame: Any) -> None:
        with self._lock:
            self._frame = frame
            self._frame_n += 1

    def publicar_leitura(self, leitura) -> None:
        item = {
            "codigo": leitura.codigo,
            "resumo": leitura.dados.resumo(),
            "produto_id": leitura.dados.produto_id,
            "nome": leitura.dados.nome_produto,
            "quantidade": leitura.dados.quantidade,
            "fragil": leitura.dados.fragil,
            "local": leitura.dados.local,
            "estruturado": leitura.dados.estruturado,
            "estrategia": leitura.estrategia,
            "em": leitura.em,
        }
        with self._lock:
            self._leituras.append(item)
            del self._leituras[:-LIMITE_LEITURAS]

    def publicar_estado(self, estado: str, rotulo: str, metricas: dict,
                        equipamento: str = "") -> None:
        with self._lock:
            self._estado = estado
            self._rotulo = rotulo
            self._metricas = metricas
            if equipamento:
                self._equipamento = equipamento

    # ── leitura (threads HTTP) ────────────────────────────────────
    def frame_atual(self):
        with self._lock:
            return self._frame, self._frame_n

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "estado": self._estado,
                "rotulo": self._rotulo,
                "equipamento": self._equipamento,
                "metricas": dict(self._metricas),
                "leituras": list(reversed(self._leituras)),  # mais nova primeiro
                "total": len(self._leituras),
            }

    def leituras(self) -> List[dict]:
        with self._lock:
            return list(reversed(self._leituras))


def _codificar_jpeg(frame, qualidade: int = 80) -> Optional[bytes]:
    """Quadro -> bytes JPEG. Devolve None se não der para codificar."""
    try:
        import cv2

        ok, buf = cv2.imencode(".jpg", frame,
                               [int(cv2.IMWRITE_JPEG_QUALITY), qualidade])
        return buf.tobytes() if ok else None
    except Exception as exc:  # noqa: BLE001
        log.debug("falha ao codificar JPEG: %s", exc)
        return None


class _Manipulador(BaseHTTPRequestHandler):
    estado: EstadoCompartilhado = None       # injetado pelo ServidorLocal
    fps_video: float = 15.0
    qualidade: int = 80

    # O log padrão do BaseHTTPRequestHandler escreve uma linha por
    # requisição no stderr. Com MJPEG isso inunda o terminal do Agent.
    def log_message(self, formato, *args):  # noqa: A003
        return

    # ── utilidades ────────────────────────────────────────────────
    def _json(self, dados: dict | list, codigo: int = 200) -> None:
        corpo = json.dumps(dados, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        # O painel roda em file:// dentro do Electron, cuja origem é
        # "null". Sem isto o fetch do estado é bloqueado pelo CORS.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(corpo)

    def do_GET(self) -> None:  # noqa: N802
        caminho = self.path.split("?")[0].rstrip("/") or "/"

        if caminho == "/video":
            self._stream()
        elif caminho == "/estado":
            self._json(self.estado.snapshot())
        elif caminho == "/leituras":
            self._json(self.estado.leituras())
        elif caminho == "/":
            self._pagina()
        else:
            self._json({"erro": "rota desconhecida"}, 404)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.end_headers()

    # ── o stream ──────────────────────────────────────────────────
    def _stream(self) -> None:
        """
        MJPEG: uma resposta que nunca termina, com um JPEG por parte.

        Só envia quadro NOVO. Reenviar o mesmo quadro gastaria banda e
        CPU sem mudar nada na tela.
        """
        self.send_response(200)
        self.send_header("Age", "0")
        self.send_header("Cache-Control", "no-cache, private")
        self.send_header("Pragma", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type",
                         "multipart/x-mixed-replace; boundary=quadro")
        self.end_headers()

        intervalo = 1.0 / self.fps_video if self.fps_video > 0 else 0.0
        ultimo_n = -1

        try:
            while True:
                inicio = time.monotonic()
                frame, n = self.estado.frame_atual()

                if frame is not None and n != ultimo_n:
                    ultimo_n = n
                    jpeg = _codificar_jpeg(frame, self.qualidade)
                    if jpeg:
                        self.wfile.write(b"--quadro\r\n")
                        self.wfile.write(b"Content-Type: image/jpeg\r\n")
                        self.wfile.write(
                            f"Content-Length: {len(jpeg)}\r\n\r\n".encode())
                        self.wfile.write(jpeg)
                        self.wfile.write(b"\r\n")

                resto = intervalo - (time.monotonic() - inicio)
                time.sleep(resto if resto > 0 else 0.001)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            # O usuário fechou a tela. É o fim normal de um stream.
            pass
        except Exception as exc:  # noqa: BLE001
            log.debug("stream encerrado: %s", exc)

    # ── página de conferência ─────────────────────────────────────
    def _pagina(self) -> None:
        html = """<!doctype html><meta charset="utf-8">
<title>Gestock Drone - Agent</title>
<style>
 body{background:#0b0e14;color:#e6edf3;font:14px system-ui;margin:0;padding:24px}
 h1{font-size:16px;font-weight:600;margin:0 0 16px}
 img{max-width:100%;border-radius:8px;border:1px solid #223}
 pre{background:#111722;padding:12px;border-radius:8px;overflow:auto}
</style>
<h1>Gestock Drone - o que o Agent esta vendo</h1>
<img src="/video" alt="video do drone">
<pre id="e">carregando...</pre>
<script>
setInterval(async()=>{
  try{
    const r = await fetch('/estado');
    document.getElementById('e').textContent =
      JSON.stringify(await r.json(), null, 2);
  }catch(e){}
}, 1000);
</script>"""
        corpo = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)


class ServidorLocal:
    """
    Sobe o servidor numa thread separada.

    Se a porta pedida estiver ocupada, tenta as seguintes: abrir o
    aplicativo duas vezes não pode derrubar o Agent com "Address
    already in use".
    """

    def __init__(self, estado: EstadoCompartilhado, porta: int = 8765,
                 tentativas: int = 10, fps_video: float = 15.0,
                 qualidade: int = 80) -> None:
        self.estado = estado
        self.porta_pedida = porta
        self.tentativas = tentativas
        self.fps_video = fps_video
        self.qualidade = qualidade
        self._srv: Optional[_Servidor] = None
        self._thread: Optional[threading.Thread] = None
        self.porta: Optional[int] = None

    def iniciar(self) -> Optional[int]:
        manipulador = type("_ManipuladorLigado", (_Manipulador,), {
            "estado": self.estado,
            "fps_video": self.fps_video,
            "qualidade": self.qualidade,
        })

        for i in range(self.tentativas):
            porta = self.porta_pedida + i
            try:
                srv = _Servidor(("127.0.0.1", porta), manipulador)
            except OSError as exc:
                if i == self.tentativas - 1:
                    log.error("Nenhuma porta livre a partir de %s: %s",
                              self.porta_pedida, exc)
                    return None
                continue

            self._srv = srv
            self.porta = porta
            self._thread = threading.Thread(
                target=srv.serve_forever, name="servidor-local", daemon=True)
            self._thread.start()

            # Linha que o aplicativo procura no stdout para saber a porta.
            print(f"GESTOCK_SERVIDOR porta={porta}", flush=True)
            log.info("Vídeo e estado em http://127.0.0.1:%s/", porta)
            return porta

        return None

    def parar(self) -> None:
        if self._srv is not None:
            try:
                self._srv.shutdown()
                self._srv.server_close()
            except Exception:  # noqa: BLE001
                pass
            self._srv = None
