"""
pipeline.py — as variantes da imagem que o leitor experimenta.

Um QR falha de maneiras diferentes, e cada tratamento resolve um tipo
de falha:

    CINZA      a imagem como veio. Etiqueta boa, luz boa: resolve aqui.
    CLAHE      equaliza contraste por região. Salva prateleira no escuro
               com um ponto de luz estourado no mesmo quadro.
    SHARP      unsharp mask. Devolve a borda que o movimento do drone
               borrou — é o tratamento do voo, não da foto parada.
    OTSU       binariza com limiar global. Etiqueta impressa, bem
               iluminada, é onde o zbar mais gosta de ler.
    ADAPT      limiar por vizinhança. Salva quando metade da etiqueta
               está na sombra da prateleira.
    OTSU_INV   inverte. Etiqueta clara sobre fundo escuro, ou reflexo
               que trocou o preto pelo branco.

DUAS DECISÕES DE DESEMPENHO MORAM AQUI:

1. Tudo é calculado SOB DEMANDA e memoizado. Pedir OTSU calcula cinza e
   CLAHE no caminho, e uma segunda pedida não recalcula nada. Isso é o
   que permite ao leitor experimentar as variantes em QUALQUER ordem
   sem pagar duas vezes pela mesma conta.

2. A ordem de tentativa é do leitor, não daqui. Ele começa pela que
   funcionou da última vez, porque num galpão a iluminação não muda a
   cada quadro: a variante que leu a etiqueta anterior quase sempre lê
   a próxima.
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List

# Ordem de fallback quando ainda não se sabe qual funciona nesta cena.
# Vai da mais barata e mais provável para a mais específica.
ORDEM_PADRAO: List[str] = ["CINZA", "CLAHE", "SHARP", "OTSU", "ADAPT", "OTSU_INV"]

# Rótulo legível para a tela do operador.
ROTULOS: Dict[str, str] = {
    "ORIGINAL": "Câmera",
    "CINZA": "Preto e branco",
    "CLAHE": "Contraste local",
    "SHARP": "Realce de borda",
    "OTSU": "Binarizada",
    "ADAPT": "Binarizada por região",
    "OTSU_INV": "Binarizada invertida",
}


class Pipeline:
    """
    As variantes de UM quadro, calculadas sob demanda e guardadas.

        p = Pipeline(frame, clahe)
        p.obter("OTSU")     # calcula cinza -> clahe -> otsu
        p.obter("CLAHE")    # já está pronto, não recalcula
    """

    def __init__(self, imagem: Any, clahe: Any) -> None:
        self._imagem = imagem
        self._clahe = clahe
        self._cache: Dict[str, Any] = {}
        self._receitas: Dict[str, Callable[[], Any]] = {
            "CINZA": self._cinza,
            "CLAHE": self._clahe_img,
            "SHARP": self._sharp,
            "OTSU": self._otsu,
            "ADAPT": self._adapt,
            "OTSU_INV": self._otsu_inv,
        }

    # ── receitas ──────────────────────────────────────────────────
    def _cinza(self):
        import cv2

        img = self._imagem
        return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img

    def _clahe_img(self):
        return self._clahe.apply(self.obter("CINZA"))

    def _sharp(self):
        import cv2

        base = self.obter("CLAHE")
        desfoque = cv2.GaussianBlur(base, (0, 0), sigmaX=1.5)
        return cv2.addWeighted(base, 1.6, desfoque, -0.6, 0)

    def _otsu(self):
        import cv2

        _, binaria = cv2.threshold(self.obter("CLAHE"), 0, 255,
                                   cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return binaria

    def _adapt(self):
        import cv2

        return cv2.adaptiveThreshold(
            self.obter("CLAHE"), 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, blockSize=15, C=4)

    def _otsu_inv(self):
        import cv2

        return cv2.bitwise_not(self.obter("OTSU"))

    # ── acesso ────────────────────────────────────────────────────
    def obter(self, nome: str) -> Any:
        """A variante pedida, calculando só o que ainda falta."""
        if nome == "ORIGINAL":
            return self._imagem
        if nome in self._cache:
            return self._cache[nome]

        receita = self._receitas.get(nome)
        if receita is None:
            raise KeyError(f"variante desconhecida: {nome}")

        imagem = receita()
        self._cache[nome] = imagem
        return imagem

    @property
    def calculadas(self) -> List[str]:
        """Quais variantes este quadro realmente custou."""
        return list(self._cache)
