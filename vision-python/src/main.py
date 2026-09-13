import cv2
import numpy as np
import mss
import requests
import os
import sys
import threading
import traceback
from datetime import datetime
from pyzbar.pyzbar import decode

# Beep cross-platform (Windows usa winsound, demais usam print BEL)
try:
    import winsound
    def tocar_bip():
        threading.Thread(
            target=lambda: winsound.Beep(1400, 220),
            daemon=True
        ).start()
        threading.Timer(
            0.30,
            lambda: threading.Thread(
                target=lambda: winsound.Beep(1900, 160),
                daemon=True
            ).start()
        ).start()
except ImportError:
    def tocar_bip():
        sys.stdout.write("\a")
        sys.stdout.flush()

# ─────────────────────────────────────────────
#  Configurações
# ─────────────────────────────────────────────
API_URL    = "http://localhost:3000/api/leituras"
EMPRESA_ID = os.getenv("EMPRESA_ID")

UPSCALE_FACTOR    = 2.2   # Lanczos4 – reduzir para 1.8 se ainda travar
CROP_X1, CROP_Y1  = 0.05, 0.05
CROP_X2, CROP_Y2  = 0.95, 0.95
COOLDOWN_SEGUNDOS = 5


# ─────────────────────────────────────────────
#  Utilidades
# ─────────────────────────────────────────────
def safe_print(*args):
    try:
        print(" ".join(str(a) for a in args).encode("ascii", errors="replace").decode("ascii"), flush=True)
    except Exception:
        pass


def enviar_api(empresa_id: int, data: str) -> None:
    payload = {
        "empresa_id": empresa_id,
        "codigo_qr": data,
        "local_lido": "DRONE",
        "status": "lido",
        "timestamp": datetime.now().isoformat(),
    }
    try:
        r = requests.post(API_URL, json=payload, timeout=3)
        safe_print(f"[API] {r.status_code}")
    except Exception as e:
        safe_print(f"[API] Erro: {e}")


# ─────────────────────────────────────────────
#  Objetos pré-alocados (evita recriar a cada frame)
# ─────────────────────────────────────────────
CLAHE = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))


def pipeline(gray: np.ndarray):
    """
    5 variantes rápidas em ordem crescente de custo.
    Todas operações nativas OpenCV (C++), sem loops Python.
    Removidos: fastNlMeansDenoising (~30ms), bilateralFilter (~15ms), morphologyEx extra.
    """
    # 1. CLAHE – equalização local (~1 ms)
    clahe = CLAHE.apply(gray)

    # 2. Unsharp mask via GaussianBlur (~2 ms)
    blur  = cv2.GaussianBlur(clahe, (0, 0), sigmaX=1.5)
    sharp = cv2.addWeighted(clahe, 1.6, blur, -0.6, 0)

    # 3. Otsu sobre sharp (~1 ms)
    _, otsu = cv2.threshold(sharp, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # 4. Threshold adaptativo gaussiano (~3 ms)
    adaptive = cv2.adaptiveThreshold(
        clahe, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=15, C=4
    )

    # 5. Inversão do Otsu – cobre QR claro em fundo escuro (~0.5 ms)
    otsu_inv = cv2.bitwise_not(otsu)

    return [
        ("CLAHE",    clahe),
        ("SHARP",    sharp),
        ("OTSU",     otsu),
        ("ADAPTIVE", adaptive),
        ("OTSU_INV", otsu_inv),
    ]


def detectar(variantes):
    for nome, img in variantes:
        resultados = decode(img)
        if resultados:
            return resultados, img, nome
    return [], variantes[1][1], "NONE"   # exibe SHARP no debug quando falha


# ─────────────────────────────────────────────
#  Inicialização
# ─────────────────────────────────────────────
if not EMPRESA_ID:
    safe_print("ERRO: EMPRESA_ID nao foi informado.")
    sys.exit(1)

safe_print("Empresa:", EMPRESA_ID)
safe_print("Scanner iniciado. ESC para encerrar.")

ultimo_qr:    str | None      = None
ultimo_envio: datetime | None = None

# ─────────────────────────────────────────────
#  Loop principal
# ─────────────────────────────────────────────
with mss.mss() as sct:
    monitor = sct.monitors[1]

    try:
        while True:
            # ── Captura ───────────────────────────────────────────────────────
            screenshot = sct.grab(monitor)
            frame = cv2.cvtColor(np.array(screenshot), cv2.COLOR_BGRA2BGR)

            h_full, w_full = frame.shape[:2]
            x1 = int(w_full * CROP_X1)
            y1 = int(h_full * CROP_Y1)
            x2 = int(w_full * CROP_X2)
            y2 = int(h_full * CROP_Y2)

            recorte = frame[y1:y2, x1:x2]

            # ── Upscale Lanczos4 ──────────────────────────────────────────────
            recorte_up = cv2.resize(
                recorte, None,
                fx=UPSCALE_FACTOR, fy=UPSCALE_FACTOR,
                interpolation=cv2.INTER_LANCZOS4
            )
            gray = cv2.cvtColor(recorte_up, cv2.COLOR_BGR2GRAY)

            # ── Pipeline e detecção ───────────────────────────────────────────
            variantes                        = pipeline(gray)
            qr_codes, img_debug, estrategia  = detectar(variantes)

            data: str | None = None

            if qr_codes:
                qr   = qr_codes[0]
                data = qr.data.decode("utf-8", errors="replace").strip()

                scale = 1.0 / UPSCALE_FACTOR
                rx, ry, rw, rh = qr.rect
                ox = int(rx * scale) + x1
                oy = int(ry * scale) + y1
                ow = int(rw * scale)
                oh = int(rh * scale)

                cv2.rectangle(frame, (ox, oy), (ox + ow, oy + oh), (0, 255, 0), 3)
                label = data[:40].encode("ascii", errors="replace").decode()
                cv2.putText(frame, f"[{estrategia}] {label}",
                            (ox, max(oy - 10, 20)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 0), 2)

            # ── Cooldown e envio ──────────────────────────────────────────────
            if data and data != ultimo_qr:
                agora = datetime.now()
                if ultimo_envio is None or (agora - ultimo_envio).total_seconds() >= COOLDOWN_SEGUNDOS:
                    ultimo_qr    = data
                    ultimo_envio = agora
                    safe_print(f"[QR] '{estrategia}': {data}")
                    tocar_bip()
                    enviar_api(int(EMPRESA_ID), data)

            # ── HUD ───────────────────────────────────────────────────────────
            cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 100, 0), 2)
            status_cor = (0, 255, 0) if data else (0, 120, 255)
            status_txt = f"QR: {data[:35]}" if data else "Aguardando QR..."
            cv2.putText(frame, status_txt, (x1 + 8, y2 - 12),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, status_cor, 2)
            cv2.putText(frame, f"Empresa: {EMPRESA_ID}", (12, 24),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)

            # ── Exibição ──────────────────────────────────────────────────────
            cv2.imshow("Monitoramento QR [ESC para sair]", frame)

            debug_show = cv2.resize(img_debug, (640, 400))
            cv2.putText(debug_show, f"Estrategia: {estrategia}", (8, 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, 200, 1)
            cv2.imshow("Debug - Filtro Ativo", debug_show)

            if cv2.waitKey(1) & 0xFF == 27:
                break

    except Exception:
        traceback.print_exc()

cv2.destroyAllWindows()
safe_print("Scanner encerrado.")