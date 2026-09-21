import { useEffect, useMemo, useRef, useState } from "react";
import logo from "../assets/logo-gestock.png";
import drone from "../assets/drone.png";
import "../styles/LoadingScreen.css";

const MINIMUM_DURATION = 1200;

const STAGES = [
  { until: 24, label: "Energizando a base" },
  { until: 49, label: "Preparando a experiência" },
  { until: 74, label: "Carregando a interface" },
  { until: 94, label: "Organizando seu espaço" },
  { until: 100, label: "Pronto para explorar" }
];

export default function LoadingScreen({ onComplete }) {
  const [progress, setProgress] = useState(4);
  const [departing, setDeparting] = useState(false);
  const completedRef = useRef(false);
  const droneUnitRef = useRef(null);

  const stage = useMemo(
    () => STAGES.find((item) => progress <= item.until) || STAGES.at(-1),
    [progress]
  );

  useEffect(() => {
    document.body.classList.add("gestock-is-loading");

    let pageReady = document.readyState === "complete";
    const startedAt = performance.now();

    function handleLoad() {
      pageReady = true;
    }

    window.addEventListener("load", handleLoad, { once: true });

    const interval = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;

      setProgress((current) => {
        let target;

        if (!pageReady) {
          target = Math.min(88, 8 + elapsed / 34);
        } else if (elapsed < MINIMUM_DURATION) {
          target = Math.min(96, 10 + elapsed / 29);
        } else {
          target = 100;
        }

        if (target >= 100) return 100;

        const step = Math.max(0.65, (target - current) * 0.12);
        return Math.min(99, Math.round((current + step) * 10) / 10);
      });
    }, 55);

    return () => {
      window.removeEventListener("load", handleLoad);
      window.clearInterval(interval);
      document.body.classList.remove("gestock-is-loading");
      document.body.classList.remove("gestock-is-handoff");
    };
  }, []);

  useEffect(() => {
    if (progress < 100 || completedRef.current) return;

    completedRef.current = true;
    let frame;

    const takeoffTimer = window.setTimeout(() => {
      const unit = droneUnitRef.current;
      const loaderDrone = unit?.querySelector(".gestock-loader__drone");
      /*
       * O drone canônico compartilhado por Home e Sobre é o ponto de
       * chegada da abertura. A passagem continua medindo o alvo real,
       * mesmo depois da retirada da antiga fotografia branca da Home.
       */
      const landingDrone = document.querySelector(".home .system-drone-card > svg");

      if (unit && loaderDrone && landingDrone) {
        const source = loaderDrone.getBoundingClientRect();
        const target = landingDrone.getBoundingClientRect();
        const sourceCenterX = source.left + source.width / 2;
        const sourceCenterY = source.top + source.height / 2;
        const targetCenterX = target.left + target.width / 2;
        const targetCenterY = target.top + target.height / 2;

        unit.style.setProperty("--handoff-x", `${targetCenterX - sourceCenterX}px`);
        unit.style.setProperty("--handoff-y", `${targetCenterY - sourceCenterY}px`);
        unit.style.setProperty("--handoff-scale", String(target.width / source.width));
      }

      document.body.classList.add("gestock-is-handoff");
      frame = window.requestAnimationFrame(() => setDeparting(true));
    }, 320);
    // 320ms até a decolagem + 1180ms de voo + 380ms de fusão = 1880.
    // Desmontar antes disso cortaria a troca pela metade.
    const finishTimer = window.setTimeout(() => onComplete?.(), 2000);

    return () => {
      window.clearTimeout(takeoffTimer);
      window.clearTimeout(finishTimer);
      window.cancelAnimationFrame(frame);
      completedRef.current = false;
    };
  }, [progress, onComplete]);

  const ready = progress >= 78;

  return (
    <div
      className={`gestock-loader${ready ? " is-ready" : ""}${departing ? " is-departing" : ""}`}
      aria-busy={!departing}
    >
      <div className="gestock-loader__aurora" aria-hidden="true" />
      <div className="gestock-loader__grid" aria-hidden="true" />
      <div className="gestock-loader__noise" aria-hidden="true" />

      <header className="gestock-loader__brand">
        <img src={logo} alt="Gestock" />
        <button type="button" className="gestock-loader__skip" onClick={onComplete}>Pular introdução <span aria-hidden="true">→</span></button>
      </header>

      <main className="gestock-loader__content">
        <div className="gestock-loader__eyebrow">
          <span className="gestock-loader__eyebrow-dot" />
          Bem-vindo ao Gestock
        </div>

        <div className="gestock-loader__stage" aria-hidden="true">
          <svg className="gestock-loader__route" viewBox="0 0 720 330" fill="none">
            <path d="M360 244 C430 220 465 155 535 128 C592 106 637 74 686 24" />
            <circle cx="686" cy="24" r="4" />
          </svg>

          <span className="gestock-loader__particle particle-one" />
          <span className="gestock-loader__particle particle-two" />
          <span className="gestock-loader__particle particle-three" />

          <div ref={droneUnitRef} className="gestock-loader__drone-unit">
            <div className="gestock-loader__rotor-wash wash-left" />
            <div className="gestock-loader__rotor-wash wash-right" />

            {/* O mesmo drone da página inicial e da tela de acesso.
                A abertura era a última tela que ainda montava a
                aeronave em vetor — três desenhos diferentes do mesmo
                produto é o tipo de detalhe que denuncia a costura. */}
            <img className="gestock-loader__drone" src={drone} alt="" />
          </div>

          <div className="gestock-loader__charge-beam" />
          <div className="gestock-loader__dock">
            <span className="gestock-loader__dock-ring ring-one" />
            <span className="gestock-loader__dock-ring ring-two" />
            <span className="gestock-loader__dock-core">
              <span>{Math.round(progress)}</span>
            </span>
          </div>
        </div>

        <div className="gestock-loader__copy">
          <p className="gestock-loader__phase" key={stage.label} aria-live="polite">
            {stage.label}
          </p>
          <p className="gestock-loader__caption">
            Seu inventário, em uma visão mais inteligente.
          </p>
        </div>

        <div
          className="gestock-loader__progress"
          role="progressbar"
          aria-label="Preparação visual da interface"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <div className="gestock-loader__track">
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="gestock-loader__progress-meta">
            <span>GESTOCK.OS</span>
            <strong>{String(Math.round(progress)).padStart(2, "0")}%</strong>
          </div>
        </div>
      </main>

      <footer className="gestock-loader__footer">
        <span>Visão computacional</span>
        <span>Operação logística</span>
        <span>Gestão centralizada</span>
      </footer>
    </div>
  );
}
