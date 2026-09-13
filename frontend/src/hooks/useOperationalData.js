import { useCallback, useEffect, useRef, useState } from "react";

/** Keep the last successful records visible while a refresh is in flight. */
export function useOperationalData(fetchers, { interval = 0, enabled = true } = {}) {
  const [data, setData] = useState(() => fetchers.map(() => []));
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const mounted = useRef(false);
  const inFlight = useRef(null);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!enabled || inFlight.current) return;
    const request = Symbol("operational-request");
    inFlight.current = request;
    await Promise.resolve();
    if (!mounted.current || inFlight.current !== request) return;
    if (!silent) setLoading(true);
    try {
      const responses = await Promise.allSettled(fetchers.map((fetcher) => fetcher()));
      if (!mounted.current || inFlight.current !== request) return;
      const successful = responses.every((response) => response.status === "fulfilled" && response.value?.success);
      setData((previous) => responses.map((response, index) => (
        response.status === "fulfilled" && response.value?.success
          ? response.value.data || []
          : previous[index]
      )));
      const failed = responses.find((response) => response.status !== "fulfilled" || !response.value?.success);
      setError(successful ? "" : failed?.value?.message || "Não foi possível atualizar os dados. Verifique sua conexão e tente novamente.");
      if (successful) setUpdatedAt(new Date());
    } finally {
      if (inFlight.current === request) {
        inFlight.current = null;
        if (mounted.current) setLoading(false);
      }
    }
  }, [enabled, fetchers]);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const timer = interval && enabled ? setInterval(() => { if (!document.hidden) refresh({ silent: true }); }, interval) : null;
    return () => {
      mounted.current = false;
      inFlight.current = null;
      if (timer) clearInterval(timer);
    };
  }, [enabled, interval, refresh]);

  return { data, loading, error, updatedAt, refresh };
}
