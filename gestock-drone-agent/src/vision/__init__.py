"""
vision — a camada que transforma imagem em informação.

    parser.py     texto do QR  →  campos do produto
    pipeline.py   quadro       →  variantes tratadas da imagem
    qr_reader.py  quadros      →  leituras confirmadas e sem repetição

Nada aqui fala com rede ou banco. O motor devolve leituras; quem grava
é a camada de cima. Isso é o que permite testar a visão sem subir API.
"""

from .parser import QrLido, parse_qr
from .pipeline import ORDEM_PADRAO, ROTULOS, Pipeline
from .qr_reader import Achado, EstatisticasQr, Leitura, QrEngine, texto_do_qr

__all__ = [
    "QrLido", "parse_qr",
    "Pipeline", "ORDEM_PADRAO", "ROTULOS",
    "QrEngine", "Achado", "Leitura", "EstatisticasQr", "texto_do_qr",
]
