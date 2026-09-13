import { useRef } from "react";
import DroneModel from "./DroneModel";

export default function DroneAnimation() {
  const stageRef = useRef(null);

  function handlePointerMove(event) {
    const stage = stageRef.current;
    if (!stage) return;

    const bounds = stage.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;

    stage.style.setProperty("--drone-pointer-x", `${x * 100}%`);
    stage.style.setProperty("--drone-pointer-y", `${y * 100}%`);
    stage.style.setProperty("--drone-tilt-x", `${((x - 0.5) * 3.2).toFixed(3)}deg`);
    stage.style.setProperty("--drone-tilt-y", `${((y - 0.5) * -2.8).toFixed(3)}deg`);
    stage.style.setProperty("--drone-grid-x", `${((0.5 - x) * 6).toFixed(2)}px`);
    stage.style.setProperty("--drone-grid-y", `${((0.5 - y) * 6).toFixed(2)}px`);
  }

  function resetPointer() {
    const stage = stageRef.current;
    if (!stage) return;

    stage.style.setProperty("--drone-pointer-x", "50%");
    stage.style.setProperty("--drone-pointer-y", "38%");
    stage.style.setProperty("--drone-tilt-x", "0deg");
    stage.style.setProperty("--drone-tilt-y", "0deg");
    stage.style.setProperty("--drone-grid-x", "0px");
    stage.style.setProperty("--drone-grid-y", "0px");
  }

  return (
    <div
      ref={stageRef}
      className="drone-stage"
      role="img"
      aria-label="Drone Gestock realizando uma leitura inteligente de QR Code"
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
    >
      <div className="drone-stage__ambient" aria-hidden="true" />
      <div className="drone-stage-grid" aria-hidden="true" />
      <div className="drone-stage__vignette" aria-hidden="true" />

      <div className="drone-stage__hud" aria-hidden="true">
        <span className="drone-stage__node">
          <i /> VISÃO COMPUTACIONAL · NÓ 04
        </span>
        <span className="drone-stage__signal">
          <b>LINK</b> 99.8%
        </span>
      </div>

      <div className="drone-stage__scene" aria-hidden="true">
        <div className="drone-radar">
          <span className="drone-radar__ring ring-one" />
          <span className="drone-radar__ring ring-two" />
          <span className="drone-radar__ring ring-three" />
          <span className="drone-radar__axis axis-x" />
          <span className="drone-radar__axis axis-y" />
          <span className="drone-radar__sweep" />
        </div>

        <svg className="drone-stage__orbit" viewBox="0 0 480 480">
          <circle cx="240" cy="204" r="151" />
          <path d="M76 204 H102 M378 204 H404 M240 40 V66 M240 342 V368" />
          <path className="drone-stage__orbit-dash" d="M113 118 A151 151 0 0 1 356 105" />
        </svg>

        <div className="drone-beam">
          <span className="drone-beam__volume" />
          <span className="drone-beam__scan" />
        </div>

        <div className="drone-downwash">
          <i /><i /><i /><i /><i /><i />
        </div>

        <div className="drone-craft-shadow" />

        <div className="drone-craft">
          <div className="drone-craft__flight">
            <DroneModel />
          </div>
        </div>

        <div className="drone-target">
          <span className="drone-target__corner corner-tl" />
          <span className="drone-target__corner corner-tr" />
          <span className="drone-target__corner corner-bl" />
          <span className="drone-target__corner corner-br" />
          <div className="drone-target__core">
            <svg className="drone-target__qr" viewBox="0 0 56 56">
              <g fill="none" stroke="currentColor" strokeWidth="4">
                <rect x="4" y="4" width="15" height="15" rx="2" />
                <rect x="37" y="4" width="15" height="15" rx="2" />
                <rect x="4" y="37" width="15" height="15" rx="2" />
              </g>
              <g fill="currentColor">
                <rect x="9" y="9" width="5" height="5" rx="1" />
                <rect x="42" y="9" width="5" height="5" rx="1" />
                <rect x="9" y="42" width="5" height="5" rx="1" />
                <rect x="25" y="5" width="5" height="8" rx="1" />
                <rect x="24" y="18" width="8" height="5" rx="1" />
                <rect x="37" y="25" width="6" height="6" rx="1" />
                <rect x="47" y="25" width="5" height="12" rx="1" />
                <rect x="24" y="29" width="7" height="7" rx="1" />
                <rect x="25" y="42" width="5" height="10" rx="1" />
                <rect x="35" y="39" width="7" height="5" rx="1" />
                <rect x="43" y="47" width="9" height="5" rx="1" />
              </g>
            </svg>
            <span className="drone-target__scanline" />
          </div>
          <small>OBJ · QR-04B</small>
        </div>
      </div>

      <div className="drone-chip" aria-hidden="true">
        <span className="drone-chip-dot" />
        Rastreamento ativo
      </div>

      <div className="drone-stage__telemetry" aria-hidden="true">
        <span>ALT 02.8M</span>
        <i />
        <span>FPS 60</span>
      </div>
    </div>
  );
}
