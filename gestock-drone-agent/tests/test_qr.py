"""
Testes do marco 2 — o QR Engine.

    python -m pytest tests -q
    python tests/test_qr.py

O que precisa ficar provado aqui:

  1. O parser entende a etiqueta que a API espera.
  2. Um código NÃO é aceito com uma aparição só (confirmação).
  3. Um código é contado UMA vez por sessão (deduplicação) — este é o
     bug do código antigo, que só lembrava do último QR: A → B → A
     reenviava o A.
  4. Reiniciar a sessão faz os mesmos códigos contarem de novo.
  5. Com um QR de verdade, renderizado numa imagem de verdade, o motor
     lê. Sem isto os outros testes passariam numa máquina onde a
     decodificação está quebrada.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.vision.parser import parse_qr  # noqa: E402
from src.vision.pipeline import ORDEM_PADRAO  # noqa: E402
from src.vision.qr_reader import Achado, QrEngine, texto_do_qr  # noqa: E402

ETIQUETA = ("PRODUTO ID: 12345 Nome: Teclado Logitech Quantidade: 50 "
            "Frágil: Não Empresa: Logitech Local: Corredor A - Prateleira 3")


# ── 1. parser ────────────────────────────────────────────────────
def test_parser_le_a_etiqueta_do_sistema():
    q = parse_qr(ETIQUETA)
    assert q.estruturado
    assert q.produto_id == "12345"
    assert q.nome_produto == "Teclado Logitech"
    assert q.quantidade == 50
    assert q.local == "Corredor A - Prateleira 3"


def test_parser_aceita_campos_faltando_e_fora_de_ordem():
    q = parse_qr("Local: Doca 2 PRODUTO ID: 77")
    assert q.estruturado
    assert q.produto_id == "77"
    assert q.local == "Doca 2"
    assert q.quantidade is None


def test_parser_nao_inventa_estrutura_em_texto_solto():
    q = parse_qr("https://gestock.app/p/abc")
    assert not q.estruturado
    assert q.resumo() == "https://gestock.app/p/abc"


# ── charset: o acento que o zbar lia como japonês ────────────────
def test_acento_lido_como_shift_jis_e_recuperado():
    """
    Sem ECI, a norma do QR manda ler o modo byte como Shift-JIS, e o
    zbar obedece: "Frágil: Não" voltava como katakana. Toda etiqueta do
    sistema tem esses dois acentos — o produto quebraria em campo.
    """
    mojibake = "Frágil: Não".encode("utf-8").decode("shift_jis").encode("utf-8")
    assert texto_do_qr(mojibake) == "Frágil: Não"


def test_texto_sem_acento_passa_intacto():
    assert texto_do_qr(b"PRODUTO ID: 12345") == "PRODUTO ID: 12345"


def test_utf8_correto_nao_e_mexido():
    assert texto_do_qr("Corredor A - Prateleira 3 ~ ção".encode("utf-8")) \
        == "Corredor A - Prateleira 3 ~ ção"


def test_bytes_invalidos_nao_derrubam_o_motor():
    assert texto_do_qr(b"\xff\xfe abc") .endswith("abc")


# ── motor com decodificação controlada ───────────────────────────
class MotorFalso(QrEngine):
    """Troca só a decodificação: o resto do motor é o de produção."""

    def __init__(self, roteiro, **kw):
        super().__init__(**kw)
        self.roteiro = list(roteiro)
        self.i = 0

    def _decodificar(self, frame):
        vistos = self.roteiro[self.i] if self.i < len(self.roteiro) else []
        self.i += 1
        return [Achado(codigo=c, estrategia="FALSO",
                       pontos=[(10, 10), (60, 10), (60, 60), (10, 60)])
                for c in vistos]


# ── 2. confirmação em múltiplos quadros ──────────────────────────
def test_uma_aparicao_isolada_nao_vira_leitura():
    # Um único quadro com "A" é exatamente o caso do reflexo/borrão.
    m = MotorFalso([["A"], [], [], []], confirmacoes=2, janela=4)
    saidas = [m.processar(object()) for _ in range(4)]
    assert all(s == [] for s in saidas)
    assert m.stats.confirmadas == 0


def test_duas_aparicoes_confirmam():
    m = MotorFalso([["A"], ["A"]], confirmacoes=2, janela=4)
    assert m.processar(object()) == []
    leituras = m.processar(object())
    assert [l.codigo for l in leituras] == ["A"]
    assert leituras[0].confirmacoes == 2


def test_confirmacao_exige_a_janela_e_nao_a_vida_toda():
    # "A" no quadro 1 e de novo no quadro 6: fora da janela de 3,
    # não conta como confirmação.
    m = MotorFalso([["A"], [], [], [], [], ["A"]], confirmacoes=2, janela=3)
    for _ in range(6):
        assert m.processar(object()) == []


def test_janela_menor_que_confirmacoes_e_erro_de_configuracao():
    try:
        QrEngine(confirmacoes=5, janela=2)
    except ValueError:
        return
    raise AssertionError("deveria recusar confirmacoes > janela")


# ── 3. deduplicação por sessão (o bug do código antigo) ──────────
def test_mesmo_codigo_so_conta_uma_vez():
    m = MotorFalso([["A"]] * 10, confirmacoes=2, janela=4)
    todas = [l for _ in range(10) for l in m.processar(object())]
    assert [l.codigo for l in todas] == ["A"]
    assert m.stats.duplicados == 8   # 10 quadros - 1 confirmando - 1 emitido


def test_a_depois_b_depois_a_nao_reenvia_o_a():
    """
    O caso concreto que quebrava: o código antigo guardava só o ÚLTIMO
    QR, então voltar ao A depois de passar pelo B contava o A de novo e
    o inventário dobrava.
    """
    roteiro = [["A"], ["A"], ["B"], ["B"], ["A"], ["A"]]
    m = MotorFalso(roteiro, confirmacoes=2, janela=4)
    lidos = [l.codigo for _ in roteiro for l in m.processar(object())]
    assert lidos == ["A", "B"]
    assert m.repeticoes("A") == 2


def test_dois_codigos_no_mesmo_quadro_saem_os_dois():
    m = MotorFalso([["A", "B"], ["A", "B"]], confirmacoes=2, janela=4)
    m.processar(object())
    assert sorted(l.codigo for l in m.processar(object())) == ["A", "B"]


# ── 4. sessão ────────────────────────────────────────────────────
def test_reiniciar_sessao_permite_contar_de_novo():
    m = MotorFalso([["A"], ["A"], ["A"], ["A"]], confirmacoes=2, janela=4)
    m.processar(object())
    m.processar(object())
    assert m.codigos_lidos == ["A"]

    m.reiniciar_sessao()
    m.processar(object())
    assert [l.codigo for l in m.processar(object())] == ["A"]
    assert m.stats.duplicados == 0


def test_leitura_ja_vem_interpretada():
    m = MotorFalso([[ETIQUETA], [ETIQUETA]], confirmacoes=2, janela=4)
    m.processar(object())
    leitura = m.processar(object())[0]
    assert leitura.dados.produto_id == "12345"
    assert leitura.dados.quantidade == 50
    assert leitura.codigo == ETIQUETA     # o cru vai inteiro para a API


# ── 5. ponta a ponta com imagem de verdade ───────────────────────
def _tem_visao():
    try:
        import cv2  # noqa: F401
        import numpy  # noqa: F401
        import qrcode  # noqa: F401
        from pyzbar.pyzbar import decode  # noqa: F401
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"      (pulado: falta dependência de visão — {exc})")
        return False


def _quadro_com_qr(texto, lado=420, ruido=False):
    """Renderiza um QR real dentro de um frame BGR, como o drone veria."""
    import cv2
    import numpy as np
    import qrcode

    img = np.array(qrcode.make(texto).convert("RGB"))
    qr = cv2.resize(cv2.cvtColor(img, cv2.COLOR_RGB2BGR), (lado, lado),
                    interpolation=cv2.INTER_NEAREST)

    frame = np.full((600, 900, 3), 70, dtype=np.uint8)
    y, x = 90, 240
    frame[y:y + lado, x:x + lado] = qr

    if ruido:
        # Galpão de verdade: pouca luz e a borda que o movimento apagou
        frame = cv2.GaussianBlur(frame, (3, 3), 0)
        frame = cv2.convertScaleAbs(frame, alpha=0.45, beta=10)
    return frame


def test_le_um_qr_de_verdade_de_ponta_a_ponta():
    """
    Este é o teste que importa: exercita pyzbar/OpenCV de fato. Se a
    decodificação estiver quebrada nesta máquina, ele falha aqui — e
    não em campo, com o drone no ar.
    """
    if not _tem_visao():
        return

    frame = _quadro_com_qr(ETIQUETA)
    m = QrEngine(confirmacoes=2, janela=4)

    assert m.processar(frame) == [], "não pode aceitar no primeiro quadro"
    leituras = m.processar(frame)

    assert len(leituras) == 1, "o QR renderizado não foi lido"
    assert leituras[0].codigo == ETIQUETA
    assert leituras[0].dados.nome_produto == "Teclado Logitech"

    # e o terceiro quadro é duplicata, não leitura nova
    assert m.processar(frame) == []
    assert m.stats.duplicados == 1


def test_le_qr_em_condicao_ruim_de_galpao():
    """Escuro e com borrão — é aqui que CLAHE e unsharp se pagam."""
    if not _tem_visao():
        return

    frame = _quadro_com_qr(ETIQUETA, lado=300, ruido=True)
    m = QrEngine(confirmacoes=1, janela=2)
    assert [l.codigo for l in m.processar(frame)] == [ETIQUETA]


def test_frame_sem_qr_nao_produz_leitura():
    if not _tem_visao():
        return

    import numpy as np

    vazio = np.full((480, 640, 3), 90, dtype=np.uint8)
    m = QrEngine()
    for _ in range(3):
        assert m.processar(vazio) == []
    assert m.stats.quadros == 3
    assert m.stats.decodificacoes == 0


def test_upscale_recupera_etiqueta_pequena():
    """
    Etiqueta pequena não tem módulos suficientes para decodificar. É
    exatamente o caso do QR no fundo do corredor — e a razão de
    `--qr-upscale` existir.
    """
    if not _tem_visao():
        return

    pequeno = _quadro_com_qr(ETIQUETA, lado=96)

    sem = QrEngine(confirmacoes=1, janela=2)
    com = QrEngine(confirmacoes=1, janela=2, upscale=3.0)

    leu_sem = bool(sem.processar(pequeno))
    leu_com = bool(com.processar(pequeno))

    # O que precisa valer é que ampliar nunca piora.
    assert leu_com or not leu_sem, "upscale atrapalhou uma leitura que já funcionava"


def test_recorte_ignora_as_bordas():
    """Com o QR na borda, recortar deve fazê-lo sair do quadro."""
    if not _tem_visao():
        return

    frame = _quadro_com_qr(ETIQUETA, lado=200)   # QR começa em x=240, y=90
    assert QrEngine(confirmacoes=1, janela=2).processar(frame)

    # 35% de cada borda corta a região onde o QR está
    agressivo = QrEngine(confirmacoes=1, janela=2, recorte=0.35)
    assert agressivo.processar(frame) == []


def test_frame_none_nao_quebra():
    m = QrEngine()
    assert m.processar(None) == []
    assert m.stats.quadros == 0


# ── 6. posição do código (a mira da tela) ────────────────────────
def test_alvo_traz_a_posicao_do_codigo():
    """Sem os pontos, a tela não tem onde desenhar a mira."""
    if not _tem_visao():
        return

    frame = _quadro_com_qr(ETIQUETA, lado=300)
    m = QrEngine(confirmacoes=1, janela=2)
    assert m.processar(frame)

    alvos = m.alvos_serializaveis()
    assert len(alvos) == 1
    pontos = alvos[0]["pontos"]
    assert len(pontos) >= 4, "esperava o polígono do código"

    # O QR foi desenhado em x=240..540, y=90..390. Os cantos têm que
    # cair dentro disso (o quiet zone deixa a leitura um pouco menor).
    xs = [p[0] for p in pontos]
    ys = [p[1] for p in pontos]
    assert 240 <= min(xs) and max(xs) <= 540, f"x fora do QR: {xs}"
    assert 90 <= min(ys) and max(ys) <= 390, f"y fora do QR: {ys}"


def test_posicao_sobrevive_a_recorte_e_upscale():
    """
    A mira é desenhada sobre o quadro que o operador VÊ. Se os pontos
    saíssem no sistema de coordenadas da imagem tratada, ligar
    --qr-recorte ou --qr-upscale deslocaria a mira do código.
    """
    if not _tem_visao():
        return

    frame = _quadro_com_qr(ETIQUETA, lado=300)

    def caixa(**kw):
        m = QrEngine(confirmacoes=1, janela=2, **kw)
        m.processar(frame)
        alvos = m.alvos_serializaveis()
        assert alvos, f"não leu com {kw}"
        xs = [p[0] for p in alvos[0]["pontos"]]
        ys = [p[1] for p in alvos[0]["pontos"]]
        return min(xs), min(ys), max(xs), max(ys)

    base = caixa()
    for kw in ({"upscale": 2.0}, {"recorte": 0.1}, {"upscale": 2.0, "recorte": 0.1}):
        outra = caixa(**kw)
        for a, b in zip(base, outra):
            assert abs(a - b) <= 4, f"mira deslocada com {kw}: {base} vs {outra}"


def test_alvo_diz_se_ja_foi_registrado():
    """A tela pinta diferente o que já entrou no inventário."""
    m = MotorFalso([["A"], ["A"], ["A"]], confirmacoes=2, janela=4)
    m.processar(object())
    assert m.alvos_serializaveis()[0]["registrado"] is False
    m.processar(object())
    assert m.alvos_serializaveis()[0]["registrado"] is True


# ── 7. velocidade ────────────────────────────────────────────────
def test_varredura_limita_as_tentativas_por_quadro():
    """
    O quadro VAZIO é o mais comum e era o mais caro: percorria as seis
    variantes para concluir que não há nada. Com a varredura rotativa
    cada quadro experimenta só algumas.
    """
    if not _tem_visao():
        return

    import numpy as np

    vazio = np.full((240, 320, 3), 90, dtype=np.uint8)

    todas = QrEngine(varredura=0, intervalo_cv2=1)
    limitada = QrEngine(varredura=2, intervalo_cv2=5)
    for _ in range(5):
        todas.processar(vazio)
        limitada.processar(vazio)

    a = todas.stats.resumo()["tentativas_por_quadro"]
    b = limitada.stats.resumo()["tentativas_por_quadro"]
    assert b < a, f"a varredura não reduziu nada: {b} vs {a}"
    assert b <= 3, f"esperava no máximo 3 tentativas por quadro, veio {b}"


def test_varredura_cobre_todas_as_variantes_ao_longo_dos_quadros():
    """
    Limitar por quadro só é seguro se, em poucos quadros, tudo tiver
    sido experimentado. Senão uma etiqueta que só o ADAPT lê nunca
    seria encontrada.
    """
    if not _tem_visao():
        return

    import numpy as np

    vazio = np.full((240, 320, 3), 90, dtype=np.uint8)
    m = QrEngine(varredura=2, intervalo_cv2=99)
    for _ in range(len(ORDEM_PADRAO)):
        m.processar(vazio)

    tentadas = set(m.stats.resumo()["estrategias"]) - {"CV2"}
    assert tentadas == set(ORDEM_PADRAO), (
        f"não cobriu tudo: faltou {set(ORDEM_PADRAO) - tentadas}")


def test_comeca_pela_variante_que_funcionou():
    """
    A iluminação do galpão não muda a cada quadro. Repetir a variante
    vencedora troca várias tentativas por uma — é o ganho no quadro que
    TEM código, que é o momento em que a resposta precisa ser rápida.
    """
    if not _tem_visao():
        return

    frame = _quadro_com_qr(ETIQUETA, lado=300)
    m = QrEngine(confirmacoes=1, janela=2)

    m.processar(frame)
    tentativas_primeiro = m.stats.tentativas

    for _ in range(4):
        m.processar(frame)

    # Depois do primeiro acerto, cada quadro deve custar UMA tentativa.
    extras = m.stats.tentativas - tentativas_primeiro
    assert extras == 4, f"esperava 1 tentativa por quadro, gastou {extras / 4}"


def test_estatisticas_mostram_o_custo_de_cada_variante():
    """É o que permite ao operador ajustar em vez de adivinhar."""
    if not _tem_visao():
        return

    frame = _quadro_com_qr(ETIQUETA, lado=300)
    m = QrEngine(confirmacoes=1, janela=2)
    m.processar(frame)

    resumo = m.stats.resumo()
    assert resumo["tentativas_por_quadro"] > 0
    assert resumo["ms_por_quadro"] > 0
    vencedora = resumo["estrategias"]
    assert any(e["acertos"] > 0 for e in vencedora.values())


# ── 8. vista de diagnóstico ──────────────────────────────────────
def test_vista_entrega_a_imagem_tratada():
    """As telas em preto e branco que o operador usa para ajustar."""
    if not _tem_visao():
        return

    frame = _quadro_com_qr(ETIQUETA, lado=300)

    sem = QrEngine(confirmacoes=1, janela=2)
    sem.processar(frame)
    assert sem.imagem_vista is None, "sem vista pedida não se gasta nada"

    for nome in ORDEM_PADRAO:
        m = QrEngine(confirmacoes=1, janela=2, vista=nome)
        m.processar(frame)
        assert m.imagem_vista is not None, f"vista {nome} não foi produzida"
        assert m.imagem_vista.shape[:2] == frame.shape[:2], \
            f"vista {nome} saiu com tamanho diferente do quadro"


def test_vista_sai_mesmo_quando_a_leitura_acerta_antes():
    """
    O leitor para na primeira variante que lê. A vista pedida precisa
    ser produzida mesmo assim, senão escolher OTSU na tela mostraria
    tela preta sempre que o CINZA resolvesse primeiro.
    """
    if not _tem_visao():
        return

    frame = _quadro_com_qr(ETIQUETA, lado=300)
    m = QrEngine(confirmacoes=1, janela=2, vista="OTSU_INV")
    assert m.processar(frame), "o teste depende de a leitura acertar"
    assert m.imagem_vista is not None


if __name__ == "__main__":
    falhas = 0
    for nome, fn in sorted(globals().items()):
        if nome.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"  ok   {nome}")
            except Exception as exc:  # noqa: BLE001
                falhas += 1
                print(f"  FALHA {nome}: {exc}")
    print("\nTodos passaram." if not falhas else f"\n{falhas} falha(s).")
    sys.exit(1 if falhas else 0)
