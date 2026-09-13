"""
doctor.py — diagnóstico por camadas.

    python -m src.doctor

Testa uma camada de cada vez e diz exatamente onde parou, em vez de
"não funciona". Segue a ordem do problema real:

    Python → numpy → OpenCV (import) → OpenCV (abrir vídeo)
           → ffmpeg do sistema → rede → porta do drone → stream

DETALHE IMPORTANTE: o teste do OpenCV roda num SUBPROCESSO. Se o wheel
do opencv-python for incompatível com a CPU, ele morre com SIGILL e
derruba o processo inteiro — sem exceção Python para capturar. Isolando
em subprocesso, o diagnóstico sobrevive e consegue te contar o que
aconteceu.
"""

from __future__ import annotations

import shutil
import socket
import subprocess
import sys
from typing import Optional, Tuple

OK, FALHA, AVISO = "[ ok ]", "[FALHA]", "[aviso]"


def _rodar_isolado(codigo: str, timeout: float = 25.0) -> Tuple[bool, str]:
    """Executa código Python num subprocesso. Sobrevive a SIGILL/segfault."""
    try:
        r = subprocess.run([sys.executable, "-c", codigo],
                           capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return False, "travou (timeout)"

    if r.returncode == 0:
        return True, (r.stdout or "").strip()

    # Códigos negativos = morreu por sinal do sistema operacional
    if r.returncode < 0:
        sinal = -r.returncode
        nome = {4: "SIGILL (instrução ilegal)", 11: "SIGSEGV (falha de segmentação)",
                6: "SIGABRT"}.get(sinal, f"sinal {sinal}")
        return False, f"processo morto por {nome}"

    erro = (r.stderr or "").strip().splitlines()
    return False, (erro[-1] if erro else f"código de saída {r.returncode}")


def checar_basico() -> None:
    print(f"{OK} Python {sys.version.split()[0]}  ({sys.executable})")

    ok, saida = _rodar_isolado("import numpy; print(numpy.__version__)")
    print(f"{OK if ok else FALHA} numpy {saida}")


def checar_opencv() -> bool:
    """Retorna True se o OpenCV consegue abrir vídeo sem morrer."""
    ok, versao = _rodar_isolado("import cv2; print(cv2.__version__)")
    if not ok:
        print(f"{FALHA} OpenCV — import falhou: {versao}")
        return False
    print(f"{OK} OpenCV {versao} importa")

    if versao.startswith("5."):
        print(f"{AVISO} OpenCV 5.x: os wheels pré-compilados desta série quebram")
        print("        com SIGILL em várias CPUs. Recomendado voltar para a 4.x:")
        print("        pip install 'opencv-python>=4.9,<5'")

    # O teste que realmente importa: inicializar o backend de vídeo.
    # É aqui que o SIGILL costuma acontecer.
    ok, detalhe = _rodar_isolado(
        "import cv2; c = cv2.VideoCapture(0); c.release(); print('backend de video ok')"
    )
    if ok:
        print(f"{OK} OpenCV abre o backend de vídeo")
        return True

    print(f"{FALHA} OpenCV quebra ao abrir vídeo: {detalhe}")
    if "SIGILL" in detalhe:
        print("        → Este é o problema. O binário do OpenCV usa instruções")
        print("          que a sua CPU não tem. Soluções, em ordem:")
        print("          1) pip install 'opencv-python>=4.9,<5'")
        print("          2) usar o ffmpeg do sistema: --backend ffmpeg")
    return False


def checar_ffmpeg() -> bool:
    caminho = shutil.which("ffmpeg")
    if not caminho:
        print(f"{FALHA} ffmpeg não está no PATH")
        print("        Arch: sudo pacman -S ffmpeg · Ubuntu: sudo apt install ffmpeg")
        return False
    try:
        r = subprocess.run(["ffmpeg", "-version"], capture_output=True,
                           text=True, timeout=10)
        versao = r.stdout.splitlines()[0] if r.stdout else "?"
        print(f"{OK} {versao[:60]}")
    except Exception as exc:  # noqa: BLE001
        print(f"{FALHA} ffmpeg não executou: {exc}")
        return False

    if shutil.which("ffprobe"):
        print(f"{OK} ffprobe disponível (detecta a resolução sozinho)")
    else:
        print(f"{AVISO} ffprobe ausente — informe --width e --height na mão")
    return True


def checar_porta(ip: str, porta: int, timeout: float = 3.0) -> bool:
    try:
        with socket.create_connection((ip, porta), timeout=timeout):
            print(f"{OK} porta {ip}:{porta} aberta — o drone está na rede")
            return True
    except OSError as exc:
        print(f"{FALHA} porta {ip}:{porta} fechada ({exc.__class__.__name__})")
        print("        O notebook está conectado na Wi-Fi do drone (FLOW-UFO*)?")
        return False


def checar_stream(url: str, transport: str, tem_ffmpeg: bool) -> Optional[bool]:
    if not tem_ffmpeg:
        print(f"{AVISO} stream não testado (sem ffmpeg)")
        return None

    print(f"       testando o stream por 6s: {url}")
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error",
           "-rtsp_transport", transport, "-i", url,
           "-t", "2", "-f", "null", "-"]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
    except subprocess.TimeoutExpired:
        print(f"{FALHA} o stream não respondeu em 20s")
        return False

    if r.returncode == 0:
        print(f"{OK} stream decodifica com o ffmpeg do sistema")
        return True

    erro = (r.stderr or "").strip().splitlines()
    print(f"{FALHA} ffmpeg não decodificou: {erro[-1] if erro else '?'}")
    if any("461" in l or "Unsupported Transport" in l for l in erro):
        print(f"        → tente o outro transporte: --transport "
              f"{'udp' if transport == 'tcp' else 'tcp'}")
    return False


def main(argv: Optional[list] = None) -> int:
    import argparse

    p = argparse.ArgumentParser(prog="doctor",
                                description="Diagnóstico do Gestock Drone Agent.")
    p.add_argument("--ip", default="192.168.1.1")
    p.add_argument("--port", type=int, default=7070)
    p.add_argument("--path", default="/webcam")
    p.add_argument("--transport", default="tcp", choices=["tcp", "udp"])
    p.add_argument("--skip-stream", action="store_true")
    args = p.parse_args(argv)

    url = f"rtsp://{args.ip}:{args.port}{args.path}"

    print("\n=== Gestock Drone Agent — diagnóstico ===\n")
    print("-- ambiente --")
    checar_basico()
    opencv_ok = checar_opencv()

    print("\n-- ffmpeg do sistema --")
    ffmpeg_ok = checar_ffmpeg()

    print("\n-- rede / drone --")
    porta_ok = checar_porta(args.ip, args.port)

    stream_ok = None
    if porta_ok and not args.skip_stream:
        print("\n-- stream --")
        stream_ok = checar_stream(url, args.transport, ffmpeg_ok)

    # ── conclusão acionável ───────────────────────────────────────
    print("\n=== conclusão ===")
    if not porta_ok:
        print("O drone não está acessível. Conecte na Wi-Fi dele antes de tudo.")
        return 1

    if opencv_ok:
        print("Tudo certo. Rode:")
        print("  python -m src.main --driver flow-ufo")
        return 0

    if ffmpeg_ok and stream_ok is not False:
        print("O OpenCV não abre vídeo nesta máquina, MAS o ffmpeg do sistema")
        print("funciona. Use o backend ffmpeg (não passa pelo OpenCV):")
        print("  python -m src.main --driver flow-ufo --backend ffmpeg --headless")
        print("\nPara consertar o OpenCV e voltar a ter janela de vídeo:")
        print("  pip install 'opencv-python>=4.9,<5'")
        return 0

    print("Nem o OpenCV nem o ffmpeg conseguiram abrir vídeo.")
    print("Instale o ffmpeg do sistema e rode este diagnóstico de novo.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
