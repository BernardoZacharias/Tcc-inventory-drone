import { useRef, useState } from "react";
import { toast } from "../services/toast";

/** A success message must only be shown after the server confirms the action. */
export function useOperationalAction() {
  const [pending, setPending] = useState("");
  const locked = useRef(false);

  async function act(key, request, message) {
    if (locked.current) return false;
    locked.current = true;
    setPending(key);
    try {
      const result = await request();
      if (!result?.success) {
        const detail = result?.message;
        toast.error(detail && !/backend|npm run|servidor indisponível/i.test(detail)
          ? detail : "Não foi possível concluir. Verifique sua conexão e tente novamente.");
        return false;
      }
      toast.success(message);
      return true;
    } catch {
      toast.error("Não foi possível concluir a ação. Tente novamente.");
      return false;
    } finally {
      locked.current = false;
      setPending("");
    }
  }

  return { pending, act };
}
