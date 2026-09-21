/*
 * theme.js
 * --------
 * Controle do tema claro/escuro.
 *
 * Tres estados possiveis:
 *   "dark"   -> forca escuro
 *   "light"  -> forca claro
 *   "system" -> sem atributo; o CSS segue prefers-color-scheme
 *
 * A escolha fica no localStorage. O index.html aplica o tema salvo
 * antes da primeira pintura, entao a pagina nunca "pisca".
 */

const CHAVE = "gestock-theme";

/** Le a preferencia salva. Retorna "dark" | "light" | "system". */
export function getTheme() {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === "dark" || v === "light" ? v : "system";
  } catch {
    return "system";
  }
}

/** Qual tema esta REALMENTE valendo agora (resolve o "system"). */
export function getResolvedTheme() {
  const t = getTheme();
  if (t !== "system") return t;
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}

/*
 * Desliga TODAS as transicoes durante a troca de tema.
 *
 * Por que isso e necessario: trocar o tema muda o valor de custom
 * properties (--bg-0, --line, ...). Se um elemento tem `transition`
 * numa propriedade que le esse token, o motor nao reavalia o var() e
 * o valor fica congelado no tema anterior ate um F5. Comprovado com
 * fundo, cor de texto e borda de card.
 *
 * Suprimindo as transicoes por um quadro, tudo recalcula de uma vez;
 * em seguida elas voltam para os estados normais (hover, foco...).
 */
function semTransicoes(aplicar) {
  const raiz = document.documentElement;
  raiz.setAttribute("data-theme-switching", "");

  aplicar();

  // Forca o recalculo antes de reativar as transicoes
  void raiz.offsetHeight;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => raiz.removeAttribute("data-theme-switching"));
  });
}

/** Aplica o tema no <html> e persiste a escolha. */
export function setTheme(tema) {
  semTransicoes(() => aplicarTema(tema));

  // Permite que componentes reajam a troca de tema
  window.dispatchEvent(new CustomEvent("gestock:themechange", { detail: tema }));
}

function aplicarTema(tema) {
  const raiz = document.documentElement;

  if (tema === "system") {
    raiz.removeAttribute("data-theme");
    try {
      localStorage.removeItem(CHAVE);
    } catch {
      /* sem persistencia: vale so nesta sessao */
    }
  } else {
    raiz.setAttribute("data-theme", tema);
    try {
      localStorage.setItem(CHAVE, tema);
    } catch {
      /* idem */
    }
  }
}

/**
 * Observa mudancas do tema do sistema operacional.
 * So tem efeito enquanto a preferencia estiver em "system".
 * Devolve uma funcao para cancelar a observacao.
 */
export function onSystemThemeChange(callback) {
  let mq;
  try {
    mq = window.matchMedia("(prefers-color-scheme: light)");
  } catch {
    return () => {};
  }

  const handler = () => {
    if (getTheme() === "system") callback(getResolvedTheme());
  };

  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
