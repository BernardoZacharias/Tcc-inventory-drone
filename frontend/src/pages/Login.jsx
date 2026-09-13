import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Mail, ArrowRight, AlertCircle, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "../services/toast";
import { API_URL } from "../services/api";
import { setCurrentUser, isAdminEmail } from "../utils/auth";
import logo from "../assets/logo-gestock.png";

import "../styles/Login.css";
import "../styles/PublicUX.css";


export default function Login({ setPage }) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const requestRef = useRef(null);

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

  return (
    <main className="login-page">
      <button className="login-back" onClick={() => setPage("home")}>
        ← Voltar ao início
      </button>

      <motion.div
        className="login-brand"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <img src={logo} alt="Gestock" />
      </motion.div>

      <motion.form
        className="login-card"
        onSubmit={handleLogin}
        noValidate
        aria-labelledby="login-title"
        aria-busy={loading}
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="tag">Área restrita</span>
        <h1 id="login-title">Acesso ao sistema</h1>
        <p>Entre para gerenciar empresas, leituras e operações com drone.</p>

        <div className="public-login-field">
          <label htmlFor="login-email">E-mail</label>
          <div className="input-box">
            <Mail size={18} aria-hidden="true" />
            <input
              id="login-email"
              name="email"
              type="email"
              placeholder="voce@empresa.com.br"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              disabled={loading}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
              onChange={() => { setFieldErrors((previous) => ({ ...previous, email: undefined })); setError(""); }}
            />
          </div>
          {fieldErrors.email && <span className="public-field-error" id="login-email-error">{fieldErrors.email}</span>}
        </div>

        <div className="public-login-field">
          <label htmlFor="login-password">Senha</label>
          <div className="input-box">
            <Lock size={18} aria-hidden="true" />
            <input
              id="login-password"
              name="senha"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              disabled={loading}
              aria-invalid={Boolean(fieldErrors.senha)}
              aria-describedby={fieldErrors.senha ? "login-password-error" : undefined}
              onChange={() => { setFieldErrors((previous) => ({ ...previous, senha: undefined })); setError(""); }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-pressed={showPassword}
              aria-controls="login-password"
            >
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
          {fieldErrors.senha && <span className="public-field-error" id="login-password-error">{fieldErrors.senha}</span>}
        </div>

        {error && <div className="public-form-feedback is-error" role="alert"><AlertCircle size={19} aria-hidden="true" /><span>{error}</span></div>}

        <button type="submit" className="login-button" disabled={loading}>
          {loading ? <><LoaderCircle size={18} className="public-spinner" aria-hidden="true" /> Entrando...</> : (
            <>
              Entrar <ArrowRight size={16} aria-hidden="true" />
            </>
          )}
        </button>

        <p className="login-hint">
          Use as credenciais fornecidas pelo administrador da sua empresa.
        </p>
        <button className="public-login-help" type="button" onClick={() => setPage("contact")}>
          Precisa de ajuda para acessar?
        </button>
      </motion.form>
    </main>
  );
}
