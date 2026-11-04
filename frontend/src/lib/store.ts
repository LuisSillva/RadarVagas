"use client";

import { useCallback, useEffect, useState } from "react";
import { buildDemoJobs } from "./demo-data";
import type { Job, JobPatch, Summary } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
const TOKEN_KEY = "radar.token";
const DEMO_KEY = "radar.demo.v1";

// localStorage pode não existir ou lançar erro (modo privado, iframes): sempre com try/catch.
function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* sem persistência, segue em memória */
  }
}

export type Mode = "loading" | "demo" | "live";

export function useRadar() {
  const [mode, setMode] = useState<Mode>("loading");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(
    async <T,>(path: string, init?: RequestInit, auth = token): Promise<T> => {
      const res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      });
      if (res.status === 401) throw new Error("Token recusado pela API. Confira o ADMIN_TOKEN e conecte de novo.");
      if (!res.ok) throw new Error(`A API respondeu ${res.status} em ${path}.`);
      return res.json() as Promise<T>;
    },
    [token],
  );

  const loadDemo = useCallback(() => {
    const saved = readStorage(DEMO_KEY);
    let base = buildDemoJobs();
    if (saved) {
      try {
        const overrides = JSON.parse(saved) as Record<number, JobPatch & { status_changed_at?: string }>;
        base = base.map((j) => (overrides[j.id] ? { ...j, ...overrides[j.id] } : j));
      } catch {
        /* ignora estado corrompido */
      }
    }
    setJobs(base);
    setSummary({
      last_run: {
        started_at: new Date(Date.now() - 95 * 60000).toISOString(),
        finished_at: new Date(Date.now() - 93 * 60000).toISOString(),
        stats: {},
        errors: [],
      },
    });
    setMode("demo");
  }, []);

  const loadLive = useCallback(
    async (auth: string) => {
      const [list, sum] = await Promise.all([
        request<Job[]>("/api/jobs?include_closed=false", undefined, auth),
        request<Summary>("/api/summary", undefined, auth),
      ]);
      setJobs(list);
      setSummary(sum);
      setMode("live");
    },
    [request],
  );

  // Na montagem: com token salvo e API configurada, carrega as vagas reais; senão, o exemplo.
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      await Promise.resolve();
      if (cancelled) return;
      const saved = readStorage(TOKEN_KEY);
      if (!API_URL || !saved) return loadDemo();
      setToken(saved);
      try {
        await loadLive(saved);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        loadDemo();
      }
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [loadDemo, loadLive]);

  const connect = useCallback(
    async (newToken: string) => {
      if (!API_URL) throw new Error("Defina NEXT_PUBLIC_API_URL no frontend para conectar a sua API.");
      await request("/api/auth", undefined, newToken);
      writeStorage(TOKEN_KEY, newToken);
      setToken(newToken);
      setError(null);
      await loadLive(newToken);
    },
    [loadLive, request],
  );

  const disconnect = useCallback(() => {
    writeStorage(TOKEN_KEY, null);
    setToken(null);
    loadDemo();
  }, [loadDemo]);

  const updateJob = useCallback(
    async (id: number, patch: JobPatch) => {
      const stamp = new Date().toISOString();
      const previous = jobs;
      // Atualização otimista: o cartão muda na hora, e volta se a API recusar.
      setJobs((list) =>
        list.map((j) =>
          j.id === id
            ? { ...j, ...patch, status_changed_at: patch.status && patch.status !== j.status ? stamp : j.status_changed_at }
            : j,
        ),
      );
      if (mode === "demo") {
        let overrides: Record<number, object> = {};
        try {
          overrides = JSON.parse(readStorage(DEMO_KEY) ?? "{}");
        } catch {
          overrides = {};
        }
        overrides[id] = { ...(overrides[id] ?? {}), ...patch, ...(patch.status ? { status_changed_at: stamp } : {}) };
        writeStorage(DEMO_KEY, JSON.stringify(overrides));
        return;
      }
      try {
        const updated = await request<Job>(`/api/jobs/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
        setJobs((list) => list.map((j) => (j.id === id ? updated : j)));
      } catch (e) {
        setJobs(previous);
        setError((e as Error).message);
      }
    },
    [jobs, mode, request],
  );

  const resetDemo = useCallback(() => {
    writeStorage(DEMO_KEY, null);
    loadDemo();
  }, [loadDemo]);

  return {
    mode,
    jobs,
    summary,
    error,
    clearError: () => setError(null),
    hasApi: Boolean(API_URL),
    connect,
    disconnect,
    updateJob,
    resetDemo,
  };
}
