import { useState } from "react";
import { motion } from "framer-motion";
import {
  Building2, Mail, MapPin, MessageCircle,
  Phone, Send, User, Warehouse, CheckCircle2, AlertCircle
} from "lucide-react";

import Button from "../components/Button";
import BotaoInstalador from "../components/BotaoInstalador";
import ScannerEffect from "../components/ScannerEffect";
import "../styles/Contact.css";
import "../styles/PublicUX.css";

const EMPTY = { nome: "", empresa: "", email: "", telefone: "", mensagem: "" };

export default function Contact({ setPage }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [prepared, setPrepared] = useState(false);

  const emailBody = [
    `Nome: ${form.nome.trim()}`,
    form.empresa.trim() && `Empresa: ${form.empresa.trim()}`,
    `E-mail para retorno: ${form.email.trim()}`,
    form.telefone.trim() && `Telefone: ${form.telefone.trim()}`,
    "", form.mensagem.trim()
  ].filter((line) => line !== false).join("\n");
  const emailLink = `mailto:logistica@gestock.com.br?subject=${encodeURIComponent("Contato pelo Gestock")}&body=${encodeURIComponent(emailBody)}`;

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((previous) => ({ ...previous, [e.target.name]: undefined }));
    setPrepared(false);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = {};
    if (!form.nome.trim()) nextErrors.nome = "Informe seu nome.";
    if (!form.email.trim() || e.currentTarget.elements.email.validity.typeMismatch) {
      nextErrors.email = "Informe um e-mail válido para retorno.";
    }
    if (!form.mensagem.trim()) nextErrors.mensagem = "Conte brevemente como podemos ajudar.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      e.currentTarget.elements[Object.keys(nextErrors)[0]].focus();
      setPrepared(false);
      return;
    }
    setPrepared(true);
  }

  return (
    <main className="contact-page">

      <section className="contact-hero">
        <motion.div
          className="contact-hero-content"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="tag">Contato</span>

          <h1>
            Fale com a equipe sobre o sistema de{" "}
            <strong>inventário com drone</strong>.
          </h1>

          <p>
            Canal direto para empresas interessadas em conhecer a solução,
            solicitar demonstração ou integrar operações logísticas.
          </p>

          <div className="contact-actions">
            <BotaoInstalador />
            <Button variant="secondary" onClick={() => setPage("technology")}>
              Ver tecnologia
            </Button>
          </div>
        </motion.div>

        <motion.div
          className="contact-visual"
          initial={{ opacity: 0, y: 14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <ScannerEffect />
        </motion.div>
      </section>

      <section className="contact-section">
        <div className="contact-title reveal">
          <span className="tag">Solicitar demonstração</span>
          <h2 id="contact-form-title">Vamos conversar sobre sua operação</h2>
          <p>Prepare sua mensagem ou escolha um dos canais de atendimento.</p>
        </div>

        <div className="contact-layout">
          <motion.form
            className="contact-form"
            onSubmit={handleSubmit}
            noValidate
            aria-labelledby="contact-form-title"
            aria-describedby="contact-delivery-note"
            initial={{ opacity: 0, x: -14 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="public-form-note" id="contact-delivery-note">
              Campos com * são obrigatórios. Este formulário prepara um e-mail:
              você revisa e confirma o envio no seu aplicativo. Nada é enviado automaticamente.
            </p>
            <label htmlFor="contact-nome">Nome *</label>
            <div className="public-field">
              <div className="contact-input">
                <User size={18} aria-hidden="true" />
                <input id="contact-nome" name="nome" value={form.nome} onChange={handleChange}
                       type="text" placeholder="Seu nome" autoComplete="name" required maxLength={100}
                       aria-invalid={Boolean(errors.nome)} aria-describedby={errors.nome ? "contact-nome-error" : undefined} />
              </div>
              {errors.nome && <span className="public-field-error" id="contact-nome-error">{errors.nome}</span>}
            </div>

            <label htmlFor="contact-empresa">Empresa <span className="public-optional">(opcional)</span></label>
            <div className="public-field">
              <div className="contact-input">
                <Building2 size={18} aria-hidden="true" />
                <input id="contact-empresa" name="empresa" value={form.empresa} onChange={handleChange}
                       type="text" placeholder="Nome da empresa" autoComplete="organization" maxLength={140} />
              </div>
            </div>

            <label htmlFor="contact-email">E-mail *</label>
            <div className="public-field">
              <div className="contact-input">
                <Mail size={18} aria-hidden="true" />
                <input id="contact-email" name="email" value={form.email} onChange={handleChange}
                       type="email" placeholder="contato@empresa.com.br" autoComplete="email" required maxLength={254}
                       aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "contact-email-error" : undefined} />
              </div>
              {errors.email && <span className="public-field-error" id="contact-email-error">{errors.email}</span>}
            </div>

            <label htmlFor="contact-telefone">Telefone <span className="public-optional">(opcional)</span></label>
            <div className="public-field">
              <div className="contact-input">
                <Phone size={18} aria-hidden="true" />
                <input id="contact-telefone" name="telefone" value={form.telefone} onChange={handleChange}
                       type="tel" placeholder="(00) 00000-0000" autoComplete="tel" maxLength={30} />
              </div>
            </div>

            <label htmlFor="contact-mensagem">Mensagem *</label>
            <div className="public-field">
              <textarea id="contact-mensagem" name="mensagem" value={form.mensagem} onChange={handleChange}
                        placeholder="Como é seu inventário hoje e o que você precisa melhorar?" required maxLength={2000}
                        aria-invalid={Boolean(errors.mensagem)} aria-describedby={`contact-message-hint${errors.mensagem ? " contact-mensagem-error" : ""}`} />
              <span className="public-field-hint" id="contact-message-hint">{form.mensagem.length}/2000 caracteres · Não inclua senhas ou dados sensíveis.</span>
              {errors.mensagem && <span className="public-field-error" id="contact-mensagem-error">{errors.mensagem}</span>}
            </div>

            {Object.values(errors).some(Boolean) && <div className="public-form-feedback is-error" role="alert"><AlertCircle size={18} aria-hidden="true" />Revise os campos indicados antes de continuar.</div>}
            <button type="submit" className="contact-submit">
              <Send size={16} aria-hidden="true" />Preparar mensagem
            </button>
            {prepared && <div className="public-message-ready" role="status">
              <div><CheckCircle2 size={19} aria-hidden="true" /><strong>Sua mensagem está pronta.</strong></div>
              <p>Abra seu aplicativo de e-mail e confirme o envio para logistica@gestock.com.br. Se ele não abrir, use o canal de WhatsApp ao lado.</p>
              <a href={emailLink} className="public-contact-link">Abrir aplicativo de e-mail <Mail size={16} aria-hidden="true" /></a>
            </div>}
          </motion.form>

          <motion.div
            className="contact-info reveal-dir"
            initial={{ opacity: 0, x: 14 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <h3>Canais de atendimento</h3>
            <p>Use estes canais para apresentar dúvidas e solicitar uma reunião.</p>

            <div className="contact-info-list">
              <a className="contact-info-row" href="https://wa.me/5519998383127" target="_blank" rel="noopener noreferrer" aria-label="Abrir WhatsApp comercial em nova aba: (19) 99838-3127">
                <MessageCircle aria-hidden="true" />
                <div>
                  <span>WhatsApp comercial</span>
                  <strong>(19) 99838-3127</strong>
                </div>
              </a>

              <a className="contact-info-row" href="mailto:logistica@gestock.com.br">
                <Mail aria-hidden="true" />
                <div>
                  <span>E-mail</span>
                  <strong>logistica@gestock.com.br</strong>
                </div>
              </a>

              <div className="contact-info-row">
                <MapPin />
                <div>
                  <span>Região de atuação</span>
                  <strong>Campinas e região</strong>
                </div>
              </div>

              <div className="contact-info-row">
                <Warehouse />
                <div>
                  <span>Aplicação</span>
                  <strong>Logística, estoque e inventário</strong>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
