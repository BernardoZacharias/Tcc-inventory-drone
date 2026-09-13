import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

/** Native modal keeps keyboard focus inside the menu and makes the page inert. */
export default function NavigationDialog({ open, onClose, title, children, triggerRef }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open, triggerRef]);

  return (
    <dialog
      ref={dialogRef}
      className="navigation-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="navigation-dialog__panel">
        <header className="navigation-dialog__header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-button" aria-label="Fechar menu" onClick={onClose} autoFocus>
            <X size={21} aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
