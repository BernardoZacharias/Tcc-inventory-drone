import { motion } from "framer-motion";
import {
  Eye, EyeOff, Lock, Mail, ArrowRight, AlertCircle,
  LoaderCircle, Check, Minus, X, ScanLine,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "../services/toast";
import { API_URL } from "../services/api";
import { setCurrentUser, isAdminEmail } from "../utils/auth";
import { isDesktop } from "../utils/navigation";
import usePreflight from "../hooks/usePreflight";
import logo from "../assets/logo-gestock.png";

const SUAVE = [0.23, 1, 0.32, 1];

/* Luz de status: as cores só aparecem aqui, como as luzes de
   navegação de um drone. No resto da tela, cor é só o acento. */
const LUZES = {
  ok:       { cor: "text-ok",    Icone: Check },
  alerta:   { cor: "text-warn",  Icone: Minus },
  falha:    { cor: "text-bad",   Icone: X },
  checando: { cor: "text-faint", Icone: Minus },
};

function LinhaStatus({ item, indice }) {
  const { cor, Icone } = LUZES[item.estado] ?? LUZES.checando;
  const pendente = item.estado === "checando";

  return (
    <motion.li
      className="flex items-center gap-3 py-2"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.25 + indice * 0.06, duration: 0.4, ease: SUAVE }}
    >
      <span
        className={`grid size-5 place-items-center rounded-full border border-line ${cor} ${
          pendente ? "animate-pulse" : ""
        }`}
      >
        <Icone size={11} strokeWidth={3} aria-hidden="true" />
      </span>

      <span className="text-[13px] font-medium text-body">{item.rotulo}</span>

      <span className="ml-auto font-mono text-[11px] tabular-nums text-faint">
        {item.detalhe || "—"}
      </span>
    </motion.li>
  );
}

function Campo({ id, name, rotulo, tipo, icone: Icone, erro, acao, ...resto }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-faint"
      >
        {rotulo}
      </label>

      {/* O campo é uma superfície REBAIXADA: recebe conteúdo, não se
          apresenta. Por isso fundo mais escuro que o cartão, e não mais
          claro. O anel de foco é a única coisa que o destaca. */}
      <div
        className="group flex items-center gap-3 rounded-md border border-line bg-surface-1
                   px-3.5 transition-[border-color,box-shadow,background-color] duration-200
                   focus-within:border-accent-line focus-within:bg-surface-2
                   focus-within:shadow-[0_0_0_3px_var(--accent-soft)]
                   has-[input[aria-invalid='true']]:border-bad
                   has-[input[aria-invalid='true']]:bg-bad-soft"
      >
        <Icone
          size={17}
          strokeWidth={1.75}
          aria-hidden="true"
          className="shrink-0 text-faint transition-colors duration-200 group-focus-within:text-accent"
        />
        <input
          id={id}
          name={name}
          type={tipo}
          className="h-12 w-full bg-transparent text-[15px] text-ink outline-none
                     placeholder:text-faint disabled:cursor-not-allowed disabled:opacity-50"
          {...resto}
        />
        {acao}
      </div>

      {erro && (
        <motion.span
          id={`${id}-error`}
          role="alert"
          className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-bad"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: SUAVE }}
        >
          <AlertCircle size={13} strokeWidth={2} aria-hidden="true" />
          {erro}
        </motion.span>
      )}
    </div>
  );
}

export default function Login({ setPage }) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const requestRef = useRef(null);
  const preflight = usePreflight();

  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    if (requestRef.current) return;

    const email = e.currentTarget.email.value.trim();
    const senha = e.currentTarget.senha.value;
    const nextErrors = {};
    if (!email || e.currentTarget.email.validity.typeMismatch) nextErrors.email = "Informe um e-mail válido.";
    if (!senha) nextErrors.senha = "Informe sua senha.";
    setFieldErrors(nextErrors);
    setError("");

    if (Object.keys(nextErrors).length) {
      e.currentTarget.elements[Object.keys(nextErrors)[0]].focus();
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
        signal: controller.signal
      });

      const data = await response.json().catch(() => null);
      if (requestRef.current !== controller) return;

      if (!response.ok || !data?.success || !data?.data?.token || !data?.data?.usuario) {
        setError(response.status >= 500
          ? "O serviço está indisponível no momento. Tente novamente em instantes."
          : response.status === 429
            ? "Muitas tentativas de acesso. Aguarde um pouco antes de tentar novamente."
            : "Não foi possível entrar. Confira seu e-mail e sua senha e tente novamente.");
        return;
      }

      const u = data.data.usuario || {};
      const usuario = {
        id: u.id,
        nome: u.nome,
        email: u.email,
        perfil: u.perfil || (isAdminEmail(email) ? "admin" : "operador"),
        empresa_id: u.empresa_id ?? null
      };

      localStorage.setItem("token", data.data.token);
      setCurrentUser(usuario);
      toast.success(`Bem-vindo, ${usuario.nome || "usuário"}`);
      setPage("dashboard");
    } catch (cause) {
      if (requestRef.current !== controller) return;
      setError(cause.name === "AbortError"
        ? "O servidor demorou para responder. Tente novamente."
        : "Não foi possível conectar ao servidor. Verifique sua conexão ou tente novamente em instantes.");
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }

  const limpar = (campo) => () => {
    setFieldErrors((p) => ({ ...p, [campo]: undefined }));
    setError("");
  };

  return (
    <main className="grid min-h-dvh grid-cols-1 bg-bg-0 lg:grid-cols-[1.08fr_0.92fr]">
      {/* ═══════════ HANGAR — contexto e prontidão ═══════════ */}
      <aside className="relative isolate hidden overflow-hidden border-r border-line lg:flex lg:flex-col lg:justify-between lg:p-14 xl:p-20">
        {/* Grade de porta-paletes vista de cima. É estrutura, não enfeite:
            o produto sobrevoa exatamente isto. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.55]
                     [background-image:linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)]
                     [background-size:72px_72px]
                     [mask-image:radial-gradient(ellipse_75%_65%_at_35%_40%,#000_25%,transparent_78%)]"
        />
        {/* Varredura do scanner descendo a grade */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -z-10 h-px
                     bg-gradient-to-r from-transparent via-accent to-transparent
                     opacity-45 motion-safe:animate-[varredura_7s_var(--ease-fluid)_infinite]
                     motion-reduce:top-1/2"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-40 -top-40 -z-10 size-[36rem] rounded-full
                     bg-[radial-gradient(circle,var(--accent-soft),transparent_65%)] blur-2xl"
        />

        <motion.img
          src={logo}
          alt="Gestock"
          className="h-11 w-auto self-start"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: SUAVE }}
        />

        <motion.div
          className="max-w-[30ch]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.6, ease: SUAVE }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-line
                           bg-surface-2 px-3 py-1 text-[10px] font-semibold uppercase
                           tracking-[0.18em] text-muted">
            <ScanLine size={12} strokeWidth={2} aria-hidden="true" />
            Inventário aéreo
          </span>

          <h2 className="mt-6 font-display text-[clamp(2rem,2.6vw,2.9rem)] font-semibold
                         leading-[1.08] tracking-[-0.035em] text-ink text-balance">
            O galpão inteiro,
            <br />
            contado de cima.
          </h2>

          <p className="mt-4 text-[15px] leading-relaxed text-muted text-pretty">
            O drone sobrevoa as prateleiras, lê os QR Codes e o estoque se
            atualiza sozinho — sem escada, sem prancheta.
          </p>
        </motion.div>

        {/* ─── Assinatura: checagem pré-voo ───
            Responde antes de o operador perguntar se dá para trabalhar. */}
        <motion.section
          aria-label="Situação do sistema"
          className="w-full max-w-sm rounded-lg border border-line bg-surface-1 p-5 backdrop-blur-sm"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.6, ease: SUAVE }}
        >
          <header className="mb-1 flex items-center justify-between">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
              Checagem pré-voo
            </h3>
            <span
              className={`font-mono text-[11px] ${
                preflight.estadoGeral === "ok" ? "text-ok"
                  : preflight.estadoGeral === "falha" ? "text-bad"
                  : preflight.estadoGeral === "alerta" ? "text-warn" : "text-faint"
              }`}
            >
              {preflight.resumo}
            </span>
          </header>

          <ul className="divide-y divide-line">
            {preflight.itens.map((item, i) => (
              <LinhaStatus key={item.id} item={item} indice={i} />
            ))}
          </ul>
        </motion.section>
      </aside>

      {/* ═══════════ ACESSO — o foco da tela ═══════════ */}
      <section className="flex items-center justify-center bg-bg-1 px-6 py-14 sm:px-10 lg:px-14">
        <motion.form
          onSubmit={handleLogin}
          noValidate
          aria-labelledby="login-title"
          aria-busy={loading}
          className="w-full max-w-[26rem]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: SUAVE }}
        >
          {/* Marca aparece aqui só quando o hangar está escondido */}
          <img src={logo} alt="Gestock" className="mb-10 h-9 w-auto lg:hidden" />

          <h1
            id="login-title"
            className="font-display text-[2rem] font-semibold leading-tight
                       tracking-[-0.035em] text-ink"
          >
            Entrar
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            Acesse para acompanhar leituras, empresas e operações com drone.
          </p>

          <div className="mt-9 space-y-5">
            <Campo
              id="login-email"
              name="email"
              rotulo="E-mail"
              tipo="email"
              icone={Mail}
              erro={fieldErrors.email}
              placeholder="voce@empresa.com.br"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              required
              disabled={loading}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
              onChange={limpar("email")}
            />

            <Campo
              id="login-password"
              name="senha"
              rotulo="Senha"
              tipo={showPassword ? "text" : "password"}
              icone={Lock}
              erro={fieldErrors.senha}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              disabled={loading}
              aria-invalid={Boolean(fieldErrors.senha)}
              aria-describedby={fieldErrors.senha ? "login-password-error" : undefined}
              onChange={limpar("senha")}
              acao={
                /* 40px de alvo: o ícone tem 17px, mas o clique não. */
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={showPassword}
                  aria-controls="login-password"
                  className="-mr-2 grid size-10 shrink-0 place-items-center rounded-sm
                             text-faint transition-colors duration-150
                             hover:text-body focus-visible:text-accent"
                >
                  {showPassword
                    ? <EyeOff size={17} strokeWidth={1.75} aria-hidden="true" />
                    : <Eye size={17} strokeWidth={1.75} aria-hidden="true" />}
                </button>
              }
            />
          </div>

          {error && (
            <motion.div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-md border border-bad
                         bg-bad-soft px-4 py-3 text-[13px] leading-relaxed text-body"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: SUAVE }}
            >
              <AlertCircle size={17} strokeWidth={1.75} aria-hidden="true" className="mt-px shrink-0 text-bad" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* O único momento de acento da tela inteira. */}
          <button
            type="submit"
            disabled={loading}
            className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-md
                       bg-accent text-[15px] font-semibold text-accent-ink
                       transition-[transform,background-color,box-shadow] duration-200
                       hover:bg-accent-strong
                       active:scale-[0.985]
                       disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
          >
            {loading ? (
              <>
                <LoaderCircle size={17} strokeWidth={2} aria-hidden="true" className="animate-spin" />
                Entrando…
              </>
            ) : (
              <>
                Entrar
                <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
              </>
            )}
          </button>

          <p className="mt-6 text-center text-[12.5px] leading-relaxed text-faint text-pretty">
            Use as credenciais fornecidas pelo administrador da sua empresa.
          </p>

          {!isDesktop() && (
            <div className="mt-6 flex items-center justify-center gap-5 border-t border-line pt-6">
              <button
                type="button"
                onClick={() => setPage("home")}
                className="text-[12.5px] font-medium text-muted transition-colors
                           duration-150 hover:text-body"
              >
                Voltar ao início
              </button>
              <span aria-hidden="true" className="h-3 w-px bg-line-2" />
              <button
                type="button"
                onClick={() => setPage("contact")}
                className="text-[12.5px] font-medium text-accent transition-colors
                           duration-150 hover:text-accent-strong"
              >
                Preciso de ajuda
              </button>
            </div>
          )}
        </motion.form>
      </section>
    </main>
  );
}
