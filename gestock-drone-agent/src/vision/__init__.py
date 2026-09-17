"""
vision — a camada que transforma imagem em informação.

    parser.py     texto do QR  →  campos do produto
    qr_reader.py  quadros      →  leituras confirmadas e sem repetição

Nada aqui fala com rede ou banco. O motor devolve leituras; quem grava
é a camada de cima. Isso é o que permite testar a visão sem subir API.
"""

from .parser import QrLido, parse_qr
from .qr_reader import EstatisticasQr, Leitura, QrEngine

__all__ = ["QrLido", "parse_qr", "QrEngine", "Leitura", "EstatisticasQr"]
