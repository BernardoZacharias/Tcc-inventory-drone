"""
gerar_qr.py — cria etiquetas de teste para apontar a câmera.

Serve para provar a leitura sem depender do drone e sem inventar
formato: gera exatamente o texto que a API espera em `codigo_qr`.

    # as 3 etiquetas de exemplo, prontas para imprimir
    python scripts/gerar_qr.py

    # uma etiqueta sua
    python scripts/gerar_qr.py --produto-id 777 --nome "Cabo HDMI" \
        --quantidade 12 --local "Doca 1"

Os arquivos saem em `etiquetas/`, que o .gitignore já ignora.
Imprimir não é obrigatório: mostrar na tela do celular funciona igual.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "etiquetas"

# Mesmas colunas que o qrParser do backend procura. Manter a ordem e a
# grafia (inclusive os acentos) é o que garante que estamos testando o
# formato de produção, e não um formato inventado para o teste passar.
MODELO = ("PRODUTO ID: {produto_id} Nome: {nome} Quantidade: {quantidade} "
          "Frágil: {fragil} Empresa: {empresa} Local: {local}")

EXEMPLOS = [
    dict(produto_id="12345", nome="Teclado Logitech", quantidade="50",
         fragil="Não", empresa="Logitech", local="Corredor A - Prateleira 3"),
    dict(produto_id="12346", nome="Monitor Dell 24", quantidade="18",
         fragil="Sim", empresa="Dell", local="Corredor B - Prateleira 1"),
    dict(produto_id="20011", nome="Caixa de Parafusos", quantidade="200",
         fragil="Não", empresa="Alpha Suprimentos", local="Doca 2 - Pallet 7"),
]


def gerar(texto: str, arquivo: Path, escala: int = 10) -> None:
    import qrcode

    qr = qrcode.QRCode(
        # Correção alta: a etiqueta vai ser lida de longe, tremida e
        # possivelmente amassada. Vale gastar área para sobreviver a isso.
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=escala,
        border=4,          # a "zona quieta" — sem ela, leitor nenhum lê
    )
    qr.add_data(texto)
    qr.make(fit=True)
    qr.make_image(fill_color="black", back_color="white").save(arquivo)


def main(argv=None) -> int:
    # Mesmo motivo do src/main.py: sem isso o console do Windows
    # transforma "Frágil" em lixo e quem confere a etiqueta se assusta.
    for fluxo in (sys.stdout, sys.stderr):
        try:
            fluxo.reconfigure(encoding="utf-8", errors="replace")
        except Exception:  # noqa: BLE001
            pass

    p = argparse.ArgumentParser(description="Gera etiquetas QR de teste.")
    p.add_argument("--produto-id")
    p.add_argument("--nome")
    p.add_argument("--quantidade", default="1")
    p.add_argument("--fragil", default="Não", choices=["Sim", "Não"])
    p.add_argument("--empresa", default="Gestock")
    p.add_argument("--local", default="Corredor A")
    p.add_argument("--escala", type=int, default=10,
                   help="pixels por módulo. Aumente para imprimir maior.")
    args = p.parse_args(argv)

    try:
        import qrcode  # noqa: F401
    except Exception as exc:  # noqa: BLE001
        print(f"Falta a dependência para gerar QR ({exc}).")
        print("Rode:  pip install -r requirements.txt")
        return 1

    SAIDA.mkdir(exist_ok=True)

    if args.produto_id:
        itens = [dict(produto_id=args.produto_id, nome=args.nome or "Produto",
                      quantidade=args.quantidade, fragil=args.fragil,
                      empresa=args.empresa, local=args.local)]
    else:
        itens = EXEMPLOS

    for item in itens:
        texto = MODELO.format(**item)
        arquivo = SAIDA / f"etiqueta-{item['produto_id']}.png"
        gerar(texto, arquivo, args.escala)
        print(f"  {arquivo.relative_to(RAIZ)}")
        print(f"    {texto}")

    print(f"\n{len(itens)} etiqueta(s) em {SAIDA.relative_to(RAIZ)}/")
    print("Aponte a webcam para elas:")
    print("  python -m src.main --driver usb --qr")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
