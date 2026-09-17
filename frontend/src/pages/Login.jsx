import { motion } from "framer-motion";
import {
  Eye, EyeOff, Lock, Mail, ArrowRight, AlertCircle,
  LoaderCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "../services/toast";
import { getApiUrl } from "../services/api";
import { setCurrentUser, isAdminEmail } from "../utils/auth";
import { isDesktop } from "../utils/navigation";
import usePreflight from "../hooks/usePreflight";
import HangarScene from "../components/HangarScene";
import logo from "../assets/logo-gestock.png";
import marca from "../assets/marca-gestock.png";
import "../styles/LoginAccess.css";

const SUAVE = [0.23, 1, 0.32, 1];

/* Luz de status: as cores só aparecem aqui, como as luzes de
   navegação de um drone. No resto da tela, cor é só o acento. */
const LUZES = {
  ok:       { cor: "text-ok" },
  alerta:   { cor: "text-warn" },
  falha:    { cor: "text-bad" },
  checando: { cor: "text-faint" },
};

function Campo({ id, name, rotulo, tipo, icone: Icone, erro, acao, ...resto }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="login-field__label"
      >
        {rotulo}
      </label>

      {/* O campo é uma superfície REBAIXADA: recebe conteúdo, não se
          apresenta. Por isso fundo mais escuro que o cartão, e não mais
          claro. O anel de foco é a única coisa que o destaca. */}
      <div
        className={`login-field${erro ? " login-field--invalid" : ""}`}
      >
        <Icone
          size={17}
          strokeWidth={1.75}
          aria-hidden="true"
          className="login-field__icon"
        />
        <input
          id={id}
          name={name}
          type={tipo}
          className="login-field__input"
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
  const errorRef = useRef(null);
  const preflight = usePreflight();

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

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
      const baseUrl = await getApiUrl();
      if (requestRef.current !== controller) return;
      const response = await fetch(`${baseUrl}/auth/login`, {
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
    <main className="login-access relative min-h-dvh overflow-hidden bg-bg-0">
      {/* ── A cena cobre a TELA INTEIRA ──
          Antes ela morava só na metade esquerda e o lado direito ficava
          um vazio preto — o cartão boiava no nada. Cobrindo tudo, o
          vidro tem o que refratar e a tela deixa de ter um lado morto. */}
      <div className="absolute inset-0 hidden lg:block">
        <HangarScene />
      </div>

      {/* Véu da direita: desfoca e escurece a cena atrás do cartão,
          esvaindo para a esquerda — sem emenda dura entre os lados. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%]
                   backdrop-blur-2xl lg:block
                   [mask-image:linear-gradient(to_right,transparent,#000_26%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] lg:block
                   [background:linear-gradient(to_right,transparent,color-mix(in_srgb,var(--bg-0)_90%,transparent)_34%)]"
      />

      <div className="relative grid min-h-dvh grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
        {/* ── Coluna da cena: marca e proposta ── */}
        <aside className="relative hidden flex-col justify-between p-12 lg:flex xl:p-16">
          <motion.img
            src={logo}
            alt="Gestock"
            className="h-10 w-auto self-start drop-shadow-[0_2px_16px_rgba(0,0,0,1)]"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: SUAVE }}
          />

          <motion.div
            className="max-w-[26ch]"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.7, ease: SUAVE }}
          >
            {/* Faixa escura local: o piso do corredor é a parte mais
                clara da foto e engolia o texto branco. */}
            <div className="-m-6 rounded-lg bg-[rgba(5,7,12,0.62)] p-6 backdrop-blur-[3px]">
              {/* branco fixo: a foto atrás é escura nos dois temas */}
              <h2 className="font-display text-[clamp(1.9rem,2.2vw,2.5rem)] font-semibold
                             leading-[1.06] tracking-[-0.035em] text-white text-balance">
                O galpão inteiro,
                <br />
                contado de cima.
              </h2>

              <p className="mt-3.5 max-w-[34ch] text-[14.5px] leading-relaxed text-white/70 text-pretty">
                O drone sobrevoa as prateleiras, lê os QR Codes e o estoque se
                atualiza sozinho.
              </p>

              <div className="mt-6 flex flex-col gap-1.5">
                {preflight.itens.map((item) => {
                  const { cor } = LUZES[item.estado] ?? LUZES.checando;
                  return (
                    <span key={item.id} className="flex items-center gap-2.5">
                      <span
                        className={`size-1.5 rounded-full bg-current ${cor} ${
                          item.estado === "checando" ? "animate-pulse" : ""
                        }`}
                      />
                      <span className="min-w-[7rem] text-[11.5px] font-medium text-white/75">{item.rotulo}</span>
                      <span className="font-mono text-[10.5px] tabular-nums text-white/45">
                        {item.detalhe || "—"}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </aside>

        {/* ── Coluna do acesso ── */}
        <section className="login-access__column flex items-center justify-center px-6 py-14 sm:px-10 lg:px-12">
        <motion.form
          onSubmit={handleLogin}
          noValidate
          aria-labelledby="login-title"
          aria-busy={loading}
          className="login-access__form relative w-full max-w-[25rem] rounded-md border border-line-2
                     bg-[color-mix(in_srgb,var(--bg-1)_82%,transparent)] p-8 backdrop-blur-2xl sm:p-10
                     shadow-[0_40px_100px_-25px_rgba(0,0,0,0.95),inset_0_1px_0_0_rgba(255,255,255,0.07)]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: SUAVE }}
        >
          {/* Marca aparece aqui só quando o hangar está escondido */}
          {/* Só o símbolo: o wordmark é prateado e some no cartão claro. */}
          <img src={marca} alt="Gestock" className="mb-9 h-10 w-auto lg:hidden" />

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
              data-route-autofocus
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
                /* O alvo de clique é maior que o ícone. */
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={showPassword}
                  aria-controls="login-password"
                  disabled={loading}
                  className="login-field__action"
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
              ref={errorRef}
              tabIndex={-1}
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
      </div>
    </main>
  );
}
