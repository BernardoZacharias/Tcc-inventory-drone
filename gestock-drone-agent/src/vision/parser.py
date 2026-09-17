"""
parser.py — interpreta o texto cru do QR Code.

Espelha o qrParser do backend (api-node/src/utils/qrParser.js), que
espera etiquetas no formato:

    PRODUTO ID: 12345 Nome: Teclado Logitech Quantidade: 50
    Frágil: Não Empresa: Logitech Local: Corredor A - Prateleira 3

Quem grava de verdade é a API — ela recebe `codigo_qr` cru e faz a
propria interpretacao. Aqui o parse serve para o Agent poder MOSTRAR
ao operador o que acabou de ler, e registrar no log algo legivel em vez
de uma string solta.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

# A ordem nao importa: encontramos cada etiqueta e recortamos o valor
# ate a proxima. E isso que permite os campos virem em qualquer ordem.
ETIQUETAS = [
    ("produto_id",   re.compile(r"PRODUTO\s*ID\s*:", re.I)),
    ("nome_produto", re.compile(r"NOME\s*:", re.I)),
    ("quantidade",   re.compile(r"QUANTIDADE\s*:", re.I)),
    ("fragil",       re.compile(r"FR[ÁA]GIL\s*:", re.I)),
    ("empresa_qr",   re.compile(r"EMPRESA\s*:", re.I)),
    ("local",        re.compile(r"LOCAL\s*:", re.I)),
]


@dataclass
class QrLido:
    """Resultado da interpretacao de um QR."""

    raw: str
    produto_id: Optional[str] = None
    nome_produto: Optional[str] = None
    quantidade: Optional[int] = None
    fragil: Optional[str] = None
    empresa_qr: Optional[str] = None
    local: Optional[str] = None
    estruturado: bool = False
    campos: dict = field(default_factory=dict)

    def resumo(self) -> str:
        """Uma linha para o log e para a tela."""
        if not self.estruturado:
            texto = self.raw if len(self.raw) <= 48 else self.raw[:45] + "..."
            return texto
        partes = [self.nome_produto or self.produto_id or "sem nome"]
        if self.quantidade is not None:
            partes.append(f"{self.quantidade} un")
        if self.local:
            partes.append(self.local)
        return " | ".join(partes)


def parse_qr(bruto: str) -> QrLido:
    texto = (bruto or "").strip()
    achados = []

    for chave, regex in ETIQUETAS:
        m = regex.search(texto)
        if m:
            achados.append((chave, m.start(), m.end()))

    achados.sort(key=lambda a: a[1])

    # Duas etiquetas ja bastam para considerar estruturado: QR de
    # producao as vezes vem sem todos os campos.
    resultado = QrLido(raw=texto, estruturado=len(achados) >= 2)

    for i, (chave, _ini, fim) in enumerate(achados):
        proximo = achados[i + 1][1] if i + 1 < len(achados) else len(texto)
        valor = texto[fim:proximo].strip().rstrip(";|").strip()
        if not valor:
            continue

        resultado.campos[chave] = valor
        if chave == "quantidade":
            digitos = re.sub(r"[^\d-]", "", valor)
            resultado.quantidade = int(digitos) if digitos.lstrip("-").isdigit() else None
        else:
            setattr(resultado, chave, valor)

    return resultado
