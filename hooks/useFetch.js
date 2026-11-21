"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export function useFetch(path, query, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null });
  const reqId = useRef(0);
  const key = JSON.stringify([path, query]);
  const load = useCallback(async () => {
    if (!enabled) return;
    const id = ++reqId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api(path, { query });
      if (id === reqId.current) setState({ data, loading: false, error: null });
    } catch (e) {
      if (id === reqId.current) setState((s) => ({ data: s.data, loading: false, error: e }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

export function useDebounce(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
