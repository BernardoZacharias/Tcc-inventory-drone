"""
gerar-icone.py — cria os ícones do aplicativo a partir do logo.

    py scripts/gerar-icone.py

Gera em desktop/build/:
    icon.ico   Windows  (16, 24, 32, 48, 64, 128, 256 num arquivo só)
    icon.png   Linux    (512x512, exigido pelo AppImage)

POR QUE NÃO USAR O LOGO DIRETO
──────────────────────────────
O logo é 1679x412 — proporção 4:1. Um ícone é quadrado. Esticado para
quadrado, ele distorce; centralizado com bordas, vira uma tira de ~8px
de altura num ícone de 32px da barra de tarefas: ilegível.

Por isso recortamos só o SÍMBOLO (a lupa em forma de G), que já é quase
quadrado e é o que identifica a marca. É o mesmo caminho que Google,
Slack e Figma seguem: wordmark no site, símbolo no ícone.

O símbolo é azul e foi desenhado para fundo claro, então o ícone usa um
quadrado arredondado claro. Assim ele tem contraste tanto em barra de
tarefas escura quanto clara.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit("Pillow não instalado. Rode:  py -m pip install Pillow")

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
LOGO = RAIZ / "frontend" / "src" / "assets" / "logo-gestock.png"
SAIDA = AQUI.parent / "build"

MESTRE = 1024          # desenhamos grande e reduzimos: bordas suaves
SUPER = 4              # fator de superamostragem do fundo
MARGEM = 0.17          # respiro nas laterais (fração do lado)
RAIO = 0.225           # canto arredondado, estilo dos ícones modernos

TAMANHOS_ICO = [16, 24, 32, 48, 64, 128, 256]
FUNDO_TOPO = (255, 255, 255, 255)
FUNDO_BASE = (226, 233, 243, 255)   # azul-acinzentado bem claro


def isolar_simbolo(caminho: Path) -> Image.Image:
    """Recorta só a lupa/G, descartando o texto 'GESTOCK'."""
    im = Image.open(caminho).convert("RGBA")
    w, h = im.size
    px = im.load()

    # Só conta pixel opaco E colorido: o halo branco em volta das letras
    # tem alpha e preencheria o vão entre símbolo e texto.
    def ocupado(x: int) -> bool:
        for y in range(0, h, 2):
            r, g, b, a = px[x, y]
            if a > 180 and (r + g + b) < 600:
                return True
        return False

    colunas = [ocupado(x) for x in range(w)]
    inicio = next(i for i, v in enumerate(colunas) if v)

    # primeiro vão largo depois do símbolo
    corte, x = w, inicio
    while x < w:
        if not colunas[x]:
            fim = x
            while fim < w and not colunas[fim]:
                fim += 1
            if fim - x >= 40:
                corte = x
                break
            x = fim
        else:
            x += 1

    simbolo = im.crop((inicio, 0, corte, h))
    return simbolo.crop(simbolo.getbbox())


def fundo_arredondado(lado: int) -> Image.Image:
    """Quadrado de cantos arredondados com um degradê suave."""
    grande = lado * SUPER

    degrade = Image.new("RGBA", (1, grande))
    for y in range(grande):
        t = y / max(grande - 1, 1)
        degrade.putpixel((0, y), tuple(
            round(FUNDO_TOPO[i] + (FUNDO_BASE[i] - FUNDO_TOPO[i]) * t)
            for i in range(4)
        ))
    base = degrade.resize((grande, grande))

    mascara = Image.new("L", (grande, grande), 0)
    ImageDraw.Draw(mascara).rounded_rectangle(
        (0, 0, grande - 1, grande - 1), radius=int(grande * RAIO), fill=255
    )
    base.putalpha(mascara)
    return base.resize((lado, lado), Image.LANCZOS)


def reforcar(simbolo: Image.Image, fator: float) -> Image.Image:
    """
    Escurece e adensa o traço para os tamanhos pequenos.

    O símbolo é feito de linhas finas. Reduzido a 16px sobre fundo claro,
    o traço perde contraste e o ícone "some". Escurecer o azul e subir a
    opacidade das bordas antialiasadas devolve a leitura — é o mesmo
    ajuste manual que conjuntos de ícones profissionais fazem nos
    tamanhos pequenos.
    """
    if fator >= 1.0:
        return simbolo

    saida = simbolo.copy()
    px = saida.load()
    for x in range(saida.size[0]):
        for y in range(saida.size[1]):
            r, g, b, a = px[x, y]
            if a == 0:
                continue

            # O símbolo tem um arco claro decorativo atrás do "G". Ele é
            # quase branco (baixa saturação) e, se for reforçado junto,
            # vira um borrão cinza em volta da marca. Em 16px ele não
            # seria visto de qualquer forma: descartamos.
            azul = b - r          # o traço da marca é nitidamente azul
            if azul < 25:
                px[x, y] = (r, g, b, 0)
                continue

            # aproxima do azul da marca, em vez de clarear no antialias
            px[x, y] = (
                round(r * fator), round(g * fator), round(b * fator),
                min(255, round(a * 1.35)),
            )
    return saida


def montar(lado: int, simbolo: Image.Image, *, pequeno: bool = False) -> Image.Image:
    icone = fundo_arredondado(lado)

    # Tamanho pequeno: menos margem (marca maior) e traço reforçado.
    margem = 0.09 if pequeno else MARGEM
    marca_base = reforcar(simbolo, 0.80 if pequeno else 1.0)

    util = int(lado * (1 - 2 * margem))
    sw, sh = marca_base.size
    escala = min(util / sw, util / sh)
    novo = (max(1, round(sw * escala)), max(1, round(sh * escala)))
    marca = marca_base.resize(novo, Image.LANCZOS)

    # Centraliza. O símbolo é mais alto que largo, então centralizar pela
    # matemática já fica bom aqui.
    pos = ((lado - novo[0]) // 2, (lado - novo[1]) // 2)
    icone.alpha_composite(marca, pos)
    return icone


def main() -> int:
    if not LOGO.exists():
        sys.exit(f"logo não encontrado: {LOGO}")

    SAIDA.mkdir(parents=True, exist_ok=True)

    simbolo = isolar_simbolo(LOGO)
    print(f"  símbolo isolado: {simbolo.size[0]}x{simbolo.size[1]}")

    mestre = montar(MESTRE, simbolo)

    png = SAIDA / "icon.png"
    mestre.resize((512, 512), Image.LANCZOS).save(png)
    print(f"  {png.name}  512x512  (Linux/AppImage)")

    # Cada tamanho sai de um mestre próprio. Até 32px usamos a variante
    # com traço reforçado; acima dela, a normal. Reduzir em cascata a
    # partir de um único mestre borraria os tamanhos pequenos.
    mestre_pequeno = montar(MESTRE, simbolo, pequeno=True)

    quadros = [
        (mestre_pequeno if t <= 32 else mestre).resize((t, t), Image.LANCZOS)
        for t in TAMANHOS_ICO
    ]

    ico = SAIDA / "icon.ico"
    # append_images garante que CADA quadro ajustado entre no arquivo,
    # em vez de o Pillow redimensionar um só por conta própria.
    quadros[-1].save(ico, format="ICO",
                     sizes=[(t, t) for t in TAMANHOS_ICO],
                     append_images=quadros[:-1])
    print(f"  {ico.name}  {', '.join(str(t) for t in TAMANHOS_ICO)}  (Windows)")
    print("       16/24/32px com traço reforçado para não sumir")

    print("\n  pronto — o electron-builder pega isto automaticamente")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
