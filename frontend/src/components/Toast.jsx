import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { subscribeToasts } from "../services/toast";

const ICON = { success: CheckCircle2, error: AlertTriangle, info: Info };

function ToastItem({ item, onDismiss }) {
  const [paused, setPaused] = useState(false);
  const Icon = ICON[item.type] || Info;
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDismiss(item.id), item.type === "error" ? 8000 : 5000);
    return () => clearTimeout(timer);
  }, [paused, item.id, item.type, onDismiss]);
  return (
    <motion.div className={`toast toast-${item.type}`} role={item.type === "error" ? "alert" : "status"}
      initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <Icon size={18} className="toast-ico" aria-hidden="true" />
      <span className="toast-msg">{item.msg}</span>
      <button type="button" aria-label="Fechar notificação" onClick={() => onDismiss(item.id)} className="toast-x"><X size={16} aria-hidden="true" /></button>
    </motion.div>
  );
}

export default function ToastHub() {
  const [items, setItems] = useState([]);
  useEffect(() => subscribeToasts((item) => setItems((previous) => [...previous.slice(-3), item])), []);
  const dismiss = useCallback((id) => setItems((previous) => previous.filter((item) => item.id !== id)), []);
  return <div className="toast-hub"><AnimatePresence>{items.map((item) => <ToastItem key={item.id} item={item} onDismiss={dismiss} />)}</AnimatePresence></div>;
}
