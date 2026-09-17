"""
main.py — Gestock Drone Agent (marcos 1 e 2)

    conectar → receber frames → monitorar → reconectar sozinho   (marco 1)
    ler QR Codes com confirmação e sem repetição                 (marco 2)

Ainda NÃO faz: banco local, API, nuvem. As leituras saem no terminal.
Ligar isso no estoque é o marco 3 — e só depois que a leitura estiver
confiável, porque leitura errada gravada é pior que leitura nenhuma.

Exemplos:

    # drone real (notebook na Wi-Fi FLOW-UFO), lendo QR
    python -m src.main --driver flow-ufo --qr

    # sem janela (servidor / teste), só métricas no terminal
    python -m src.main --driver flow-ufo --headless --qr

    # sem drone, para validar o Agent em qualquer máquina
    python -m src.main --driver synthetic --qr
    python -m src.main --driver usb
    python -m src.main --driver file --source voo.mp4 --qr

    # etiqueta pequena e longe: amplia antes de decodificar
    python -m src.main --driver flow-ufo --qr --qr-upscale 2

    # qualquer outra câmera RTSP
    python -m src.main --driver rtsp --source rtsp://192.168.1.1:7070/webcam
"""

from __future__ import annotations

import argparse
import logging
import signal
import sys
import time
from typing import Optional

# Permite rodar tanto como `python -m src.main` quanto `python src/main.py`
if __package__ in (None, ""):
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from src.core.states import AgentState, StateMachine
    from src.drivers import build_driver
    from src.server import EstadoCompartilhado, ServidorLocal
    from src.video.engine import VideoEngine
    from src.vision.qr_reader import QrEngine
else:
    from .core.states import AgentState, StateMachine
    from .drivers import build_driver
    from .server import EstadoCompartilhado, ServidorLocal
    from .video.engine import VideoEngine
    from .vision.qr_reader import QrEngine

log = logging.getLogger("agent")


def saida_utf8() -> None:
    """
    Windows: quando a saída vai para um pipe (é assim que o aplicativo
    Electron lê o Agent) o Python usa cp1252, e "conexão" vira "conex?o".
    Fixar UTF-8 resolve nos dois casos; errors="replace" garante que um
    caractere exótico vindo de um QR nunca derrube o processo.

    Precisa rodar antes do argparse, senão o próprio `--help` sai torto.
    """
    for fluxo in (sys.stdout, sys.stderr):
        try:
            fluxo.reconfigure(encoding="utf-8", errors="replace")
        except Exception:  # noqa: BLE001 - fluxo já substituído/redirecionado
            pass


def configurar_log(verboso: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verboso else logging.INFO,
        format="%(asctime)s  %(levelname)-7s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


def montar_driver(args: argparse.Namespace):
    """Traduz os argumentos de linha de comando em um driver."""
    kind = args.driver

    # --backend ffmpeg troca o decodificador sem mudar mais nada:
    # usa o ffmpeg do sistema em vez do embutido no OpenCV.
    usar_ffmpeg = args.backend == "ffmpeg"
    extras = {}
    if usar_ffmpeg:
        if args.width and args.height:
            extras.update(width=args.width, height=args.height)
        if args.fps:
            extras.update(fps_maximo=args.fps)

    if kind == "flow-ufo":
        nome = "flow-ufo-ffmpeg" if usar_ffmpeg else "flow-ufo"
        return build_driver(nome, ip=args.ip, port=args.port,
                            path=args.path, transport=args.transport, **extras)
    if kind == "rtsp":
        if not args.source:
            raise SystemExit("--driver rtsp exige --source rtsp://...")
        nome = "rtsp-ffmpeg" if usar_ffmpeg else "rtsp"
        return build_driver(nome, url=args.source,
                            transport=args.transport, **extras)
    if kind == "usb":
        return build_driver("usb", index=int(args.source or 0))
    if kind == "file":
        if not args.source:
            raise SystemExit("--driver file exige --source caminho/do/video.mp4")
        return build_driver("file", path=args.source)
    return build_driver("synthetic")


def linha_status(machine: StateMachine, engine: VideoEngine,
                 qr: Optional[QrEngine] = None) -> str:
    s = engine.stats.resumo()
    estado = machine.state
    marca = "OK " if estado.saudavel else "..."
    idade = s["idade_frame_s"]
    linha = (
        f"[{marca}] {estado.rotulo:<22} "
        f"fps={s['fps']:<5} recebidos={s['recebidos']:<6} "
        f"descartados={s['descartados']:<5} falhas={s['falhas']:<5} "
        f"reconexoes={s['reconexoes']:<3} "
        f"idade={idade if idade is not None else '-'}s"
    )
    if qr is not None:
        q = qr.stats.resumo()
        linha += (f"  |  lidos={q['leituras']:<4} "
                  f"repetidos={q['duplicados']:<5} analisados={q['quadros']}")
    return linha


def main(argv: Optional[list] = None) -> int:
    saida_utf8()

    p = argparse.ArgumentParser(
        prog="gestock-drone-agent",
        description="Agent local do Gestock Drone — conexão e vídeo (marco 1).",
    )
    p.add_argument("--driver", default="flow-ufo",
                   choices=["flow-ufo", "rtsp", "usb", "file", "synthetic"],
                   help="fonte de vídeo (padrão: flow-ufo)")
    p.add_argument("--source", help="URL, caminho de arquivo ou índice da webcam")
    p.add_argument("--ip", default="192.168.1.1", help="IP do drone")
    p.add_argument("--port", type=int, default=7070, help="porta RTSP do drone")
    p.add_argument("--path", default="/webcam", help="endpoint RTSP")
    p.add_argument("--transport", default="auto", choices=["auto", "tcp", "udp"],
                   help="transporte RTSP. 'auto' (padrão) NÃO impõe transporte "
                        "e deixa o ffmpeg negociar — o FLOW-UFO responde 461 "
                        "(Unsupported Transport) quando é forçado")
    p.add_argument("--backend", default="opencv", choices=["opencv", "ffmpeg"],
                   help="quem decodifica o vídeo. Use 'ffmpeg' se o OpenCV "
                        "quebrar com 'illegal hardware instruction'")
    p.add_argument("--width", type=int, help="largura do frame (backend ffmpeg)")
    p.add_argument("--height", type=int, help="altura do frame (backend ffmpeg)")
    p.add_argument("--fps", type=int,
                   help="teto de quadros por segundo (backend ffmpeg). "
                        "Para ler QR, 15-30 sobra")
    # ── leitura de QR (marco 2) ──────────────────────────────────
    p.add_argument("--qr", action="store_true",
                   help="ligar a leitura de QR Codes")
    p.add_argument("--qr-confirmacoes", type=int, default=2, metavar="N",
                   help="quantos quadros precisam ver o mesmo código para "
                        "ele valer (padrão: 2). 1 aceita leitura isolada e "
                        "volta a errar com reflexo e borrão")
    p.add_argument("--qr-janela", type=int, default=4, metavar="M",
                   help="em quantos quadros recentes procurar essas "
                        "confirmações (padrão: 4)")
    p.add_argument("--qr-fps", type=float, default=12.0, metavar="F",
                   help="quantos quadros por segundo analisar (padrão: 12). "
                        "Analisar todos os 25 só gasta CPU: a etiqueta fica "
                        "vários quadros no enquadramento")
    p.add_argument("--qr-upscale", type=float, default=1.0, metavar="X",
                   help="amplia o quadro antes de decodificar. Use 2 quando "
                        "a etiqueta estiver pequena ou longe")
    p.add_argument("--qr-recorte", type=float, default=0.0, metavar="P",
                   help="ignora esta fração das bordas (ex.: 0.15). Foca no "
                        "centro do quadro e acelera a análise")

    # ── servidor local (o aplicativo consome daqui) ──────────────
    p.add_argument("--servidor", action="store_true",
                   help="publica o vídeo e o estado em http://127.0.0.1 "
                        "para o aplicativo exibir. Escuta só na própria "
                        "máquina: o vídeo do galpão não vai para a rede")
    p.add_argument("--porta", type=int, default=8765,
                   help="porta do servidor local (padrão: 8765). Se estiver "
                        "ocupada, tenta as 10 seguintes")
    p.add_argument("--video-fps", type=float, default=15.0, metavar="F",
                   help="quadros por segundo enviados para a tela "
                        "(padrão: 15). Não afeta a leitura de QR")
    p.add_argument("--video-qualidade", type=int, default=80, metavar="Q",
                   help="qualidade do JPEG enviado, de 1 a 100 (padrão: 80)")

    p.add_argument("--stall-timeout", type=float, default=5.0,
                   help="segundos sem frame válido até reconectar")
    p.add_argument("--max-reconnects", type=int, default=0,
                   help="0 = tentar para sempre")
    p.add_argument("--headless", action="store_true",
                   help="não abrir janela de vídeo")
    p.add_argument("--duration", type=float, default=0,
                   help="encerra após N segundos (0 = sem limite). Útil em teste.")
    p.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args(argv)

    configurar_log(args.verbose)

    driver = montar_driver(args)
    machine = StateMachine()
    engine = VideoEngine(
        driver,
        stall_timeout=args.stall_timeout,
        max_reconnects=args.max_reconnects,
        machine=machine,
    )

    qr: Optional[QrEngine] = None
    if args.qr:
        try:
            qr = QrEngine(
                confirmacoes=args.qr_confirmacoes,
                janela=args.qr_janela,
                upscale=args.qr_upscale,
                recorte=args.qr_recorte,
            )
        except ValueError as exc:
            raise SystemExit(f"Configuração de QR inválida: {exc}")

    compartilhado: Optional[EstadoCompartilhado] = None
    servidor: Optional[ServidorLocal] = None
    if args.servidor:
        compartilhado = EstadoCompartilhado()
        servidor = ServidorLocal(
            compartilhado, porta=args.porta,
            fps_video=args.video_fps, qualidade=args.video_qualidade,
        )

    log.info("Gestock Drone Agent — conexão, vídeo e leitura de QR")
    log.info("Equipamento: %s", driver.describe())
    if qr is not None:
        log.info("Leitura de QR ligada: %d confirmação(ões) em %d quadros, "
                 "analisando até %.0f quadros/s",
                 qr.confirmacoes, qr.janela, args.qr_fps)

    encerrar = {"pedido": False}

    def _sinal(_s, _f):  # noqa: ANN001
        if not encerrar["pedido"]:
            log.info("Encerrando... (Ctrl+C de novo força)")
            encerrar["pedido"] = True

    signal.signal(signal.SIGINT, _sinal)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, _sinal)

    if servidor is not None:
        compartilhado.publicar_estado(
            machine.state.value, machine.state.rotulo, {},
            equipamento=str(driver.describe()),
        )
        if servidor.iniciar() is None:
            log.error("Não consegui abrir o servidor local. O Agent continua "
                      "lendo, mas o aplicativo não vai mostrar o vídeo.")
            servidor = None

    engine.start()

    janela = "Gestock Drone Agent - ESC encerra"
    mostrar = not args.headless
    cv2 = None
    if mostrar:
        try:
            import cv2 as _cv2

            cv2 = _cv2
        except Exception as exc:  # noqa: BLE001
            log.warning("Sem interface gráfica (%s). Seguindo em modo headless.", exc)
            mostrar = False

    inicio = time.monotonic()
    ultimo_print = 0.0
    ultima_analise = 0.0
    intervalo_qr = 1.0 / args.qr_fps if args.qr_fps > 0 else 0.0
    avisou_sem_numpy = False
    codigo = 0

    try:
        while not encerrar["pedido"]:
            if args.duration and time.monotonic() - inicio >= args.duration:
                log.info("Tempo de execução atingido (%.0fs).", args.duration)
                break

            if machine.state is AgentState.ERRO:
                log.error("Agent em ERRO: %s", driver.status.last_error)
                codigo = 1
                break

            ok, frame = engine.latest_novo()
            # RawFrame (sem numpy) não serve nem para imshow nem para QR
            utilizavel = ok and hasattr(frame, "dtype")

            # A tela do aplicativo recebe o mesmo quadro que o leitor vê.
            # Só a referência é publicada: quem comprime em JPEG é a
            # thread de quem está assistindo, e só se houver alguém.
            if compartilhado is not None and utilizavel:
                compartilhado.publicar_frame(frame)

            # ── leitura de QR ────────────────────────────────────
            agora = time.monotonic()
            if qr is not None and ok:
                if not utilizavel:
                    if not avisou_sem_numpy:
                        avisou_sem_numpy = True
                        log.error("Sem numpy utilizável nesta máquina: o vídeo "
                                  "funciona, mas não dá para ler QR. Rode "
                                  "`python -m src.doctor` para o diagnóstico.")
                elif agora - ultima_analise >= intervalo_qr:
                    ultima_analise = agora
                    if machine.state is AgentState.STREAM_ATIVO:
                        machine.to(AgentState.LEITURA_ATIVA, "QR ligado")
                    try:
                        for leitura in qr.processar(frame):
                            log.info("[QR %s] %s", leitura.estrategia,
                                     leitura.dados.resumo())
                            if compartilhado is not None:
                                compartilhado.publicar_leitura(leitura)
                    except Exception as exc:  # noqa: BLE001 - visão não derruba o voo
                        log.warning("Falha ao analisar o quadro: %s", exc)

            if utilizavel and mostrar and cv2 is not None:
                cv2.imshow(janela, frame)
                if (cv2.waitKey(1) & 0xFF) == 27:  # ESC
                    break
            elif not ok:
                time.sleep(0.005)

            if agora - ultimo_print >= 1.0:
                ultimo_print = agora
                print(linha_status(machine, engine, qr), flush=True)

                if compartilhado is not None:
                    metricas = engine.stats.resumo()
                    if qr is not None:
                        metricas.update(qr.stats.resumo())
                    compartilhado.publicar_estado(
                        machine.state.value, machine.state.rotulo, metricas)
    finally:
        engine.stop()
        if servidor is not None:
            servidor.parar()
        if mostrar and cv2 is not None:
            try:
                cv2.destroyAllWindows()
            except Exception:  # noqa: BLE001
                pass

    s = engine.stats.resumo()
    log.info(
        "Resumo: %s frames em %.0fs | %s descartados | %s falhas | %s reconexões",
        s["recebidos"], s["uptime_s"], s["descartados"], s["falhas"], s["reconexoes"],
    )

    if qr is not None:
        q = qr.stats.resumo()
        log.info("Leitura: %s código(s) único(s) em %s quadros analisados "
                 "(%s repetições ignoradas)",
                 q["leituras"], q["quadros"], q["duplicados"])
        for leitura in qr.leituras():
            repetida = qr.repeticoes(leitura.codigo)
            log.info("  - %s%s", leitura.dados.resumo(),
                     f"  (visto +{repetida}x)" if repetida else "")

    return codigo


if __name__ == "__main__":
    raise SystemExit(main())
