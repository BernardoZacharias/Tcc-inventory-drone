"""
main.py — Gestock Drone Agent (marco 1)

Escopo deste marco, de propósito pequeno:

    conectar → receber frames → monitorar → reconectar sozinho

Ainda NÃO faz: leitura de QR, banco, API, nuvem. Isso entra depois que
esta camada estiver sólida — stream instável estraga qualquer coisa
construída em cima.

Exemplos:

    # drone real (notebook na Wi-Fi FLOW-UFO)
    python -m src.main --driver flow-ufo

    # sem janela (servidor / teste), só métricas no terminal
    python -m src.main --driver flow-ufo --headless

    # sem drone, para validar o Agent em qualquer máquina
    python -m src.main --driver synthetic
    python -m src.main --driver usb
    python -m src.main --driver file --source voo.mp4

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
    from src.video.engine import VideoEngine
else:
    from .core.states import AgentState, StateMachine
    from .drivers import build_driver
    from .video.engine import VideoEngine

log = logging.getLogger("agent")


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
    if usar_ffmpeg and args.width and args.height:
        extras = {"width": args.width, "height": args.height}

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


def linha_status(machine: StateMachine, engine: VideoEngine) -> str:
    s = engine.stats.resumo()
    estado = machine.state
    marca = "OK " if estado.saudavel else "..."
    idade = s["idade_frame_s"]
    return (
        f"[{marca}] {estado.rotulo:<22} "
        f"fps={s['fps']:<5} recebidos={s['recebidos']:<6} "
        f"descartados={s['descartados']:<5} falhas={s['falhas']:<5} "
        f"reconexoes={s['reconexoes']:<3} "
        f"idade={idade if idade is not None else '-'}s"
    )


def main(argv: Optional[list] = None) -> int:
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

    log.info("Gestock Drone Agent — marco 1 (conexão e vídeo)")
    log.info("Equipamento: %s", driver.describe())

    encerrar = {"pedido": False}

    def _sinal(_s, _f):  # noqa: ANN001
        if not encerrar["pedido"]:
            log.info("Encerrando... (Ctrl+C de novo força)")
            encerrar["pedido"] = True

    signal.signal(signal.SIGINT, _sinal)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, _sinal)

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

            if ok and mostrar and cv2 is not None:
                cv2.imshow(janela, frame)
                if (cv2.waitKey(1) & 0xFF) == 27:  # ESC
                    break
            elif not ok:
                time.sleep(0.005)

            agora = time.monotonic()
            if agora - ultimo_print >= 1.0:
                ultimo_print = agora
                print(linha_status(machine, engine), flush=True)
    finally:
        engine.stop()
        if mostrar and cv2 is not None:
            try:
                cv2.destroyAllWindows()
            except Exception:  # noqa: BLE001
                pass

    s = engine.stats.resumo()
    log.info(
        "Resumo: %s frames em %.0fs · %s descartados · %s falhas · %s reconexões",
        s["recebidos"], s["uptime_s"], s["descartados"], s["falhas"], s["reconexoes"],
    )
    return codigo


if __name__ == "__main__":
    raise SystemExit(main())
