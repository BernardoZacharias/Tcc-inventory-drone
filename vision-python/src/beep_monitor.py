"""
beep_monitor.py
───────────────
Monitora a saida do qr_scanner.py e emite um bipe sonoro
cada vez que um QR code e detectado.

Uso:
    python qr_scanner.py | python beep_monitor.py
"""

import sys
import winsound
import threading


# ─────────────────────────────────────────────
#  Configuracao do som
# ─────────────────────────────────────────────
FREQUENCIA_HZ  = 1000   # Tom do bipe (Hz). Mais alto = mais agudo.
DURACAO_MS     = 300    # Duracao do bipe em milissegundos.

# Palavra-chave que indica leitura bem-sucedida no terminal.
# Nao altere se nao mudou o qr_scanner.py.
PALAVRA_CHAVE  = "[QR]"


# ─────────────────────────────────────────────
#  Som em thread separada (nao bloqueia leitura)
# ─────────────────────────────────────────────
def beep():
    threading.Thread(
        target=lambda: winsound.Beep(FREQUENCIA_HZ, DURACAO_MS),
        daemon=True
    ).start()


# ─────────────────────────────────────────────
#  Loop principal
# ─────────────────────────────────────────────
print("[beep_monitor] Aguardando leituras... (Ctrl+C para sair)", flush=True)

try:
    for linha in sys.stdin:
        linha = linha.rstrip()
        print(linha, flush=True)          # repassa a saida normalmente no terminal

        if PALAVRA_CHAVE in linha:
            beep()
            print("[beep_monitor] ** BIP emitido **", flush=True)

except KeyboardInterrupt:
    print("\n[beep_monitor] Encerrado.", flush=True)