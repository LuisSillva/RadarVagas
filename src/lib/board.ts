"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BoardJob, Job, JobsFile, Status, Tracking } from "./types";

// Tudo o que você faz no board (etapa, notas, vagas cadastradas à mão) fica
// salvo neste navegador. Exportar/Importar backup leva para outro computador.
const BOARD_KEY = "radar.board.v2";
const VISIT_KEY = "radar.lastVisit";

type TrackingMap = Record<string, Tracking>;

// localStorage pode não existir ou lançar erro (modo privado, iframes): sempre com try/catch.
function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sem persistência, segue em memória */
  }
}

function isTrackingMap(value: unknown): value is TrackingMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every(
    (t) =>
      t &&
      typeof t === "object" &&
      typeof (t as Tracking).status === "string" &&
      typeof (t as Tracking).job?.id === "string",
  );
}

export interface NewJob {
  company: string;
  title: string;
  url: string;
  location: string;
  region: Job["region"];
  level: Job["level"];
  remote: boolean;
}

export function useBoard(data: JobsFile | null) {
  const [tracking, setTracking] = useState<TrackingMap>({});
  const [ready, setReady] = useState(false);
  // Vagas que apareceram depois da sua última visita ganham a marca "nova".
  const [lastVisit, setLastVisit] = useState<string | null>(null);

  useEffect(() => {
    const saved = read<unknown>(BOARD_KEY);
    // Ler o navegador só depois de montar evita diferença entre o HTML estático e o cliente.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (isTrackingMap(saved)) setTracking(saved);
    setLastVisit(read<string>(VISIT_KEY));
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    write(VISIT_KEY, new Date().toISOString());
  }, []);

  const save = useCallback((next: TrackingMap) => {
    setTracking(next);
    write(BOARD_KEY, next);
  }, []);

  const jobs = useMemo<BoardJob[]>(() => {
    const result: BoardJob[] = [];
    const fromFile = new Set<string>();
    for (const job of data?.jobs ?? []) {
      fromFile.add(job.id);
      const t = tracking[job.id];
      // Vaga encerrada que você nunca mexeu não interessa mais.
      if (!job.active && !t) continue;
      result.push({
        ...job,
        status: t?.status ?? "new",
        notes: t?.notes ?? "",
        statusChangedAt: t?.statusChangedAt ?? job.firstSeen,
      });
    }
    // Vagas que você acompanha e que já saíram do arquivo, mais as cadastradas à mão.
    for (const [id, t] of Object.entries(tracking)) {
      if (fromFile.has(id)) continue;
      const manual = t.job.source === "manual";
      result.push({ ...t.job, active: manual, status: t.status, notes: t.notes, statusChangedAt: t.statusChangedAt });
    }
    return result;
  }, [data, tracking]);

  const updateJob = useCallback(
    (id: string, patch: { status?: Status; notes?: string }) => {
      const job = jobs.find((j) => j.id === id);
      if (!job) return;
      const prev = tracking[id];
      const status = patch.status ?? prev?.status ?? "new";
      const notes = patch.notes ?? prev?.notes ?? "";
      const next = { ...tracking };
      if (status === "new" && !notes && job.source !== "manual") {
        delete next[id];
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { status: _s, notes: _n, statusChangedAt: _c, ...snapshot } = job;
        next[id] = {
          status,
          notes,
          statusChangedAt: patch.status && patch.status !== job.status ? new Date().toISOString() : job.statusChangedAt,
          job: snapshot,
        };
      }
      save(next);
    },
    [jobs, tracking, save],
  );

  const addManual = useCallback(
    (input: NewJob) => {
      const now = new Date().toISOString();
      const id = `manual:${crypto.randomUUID()}`;
      const job: Job = {
        id,
        source: "manual",
        company: input.company.trim(),
        category: null,
        title: input.title.trim(),
        url: input.url.trim(),
        location: input.location.trim() || null,
        region: input.region,
        remote: input.remote,
        level: input.level,
        postedAt: null,
        deadline: null,
        firstSeen: now,
        lastSeen: now,
        active: true,
      };
      save({ ...tracking, [id]: { status: "saved", notes: "", statusChangedAt: now, job } });
      return id;
    },
    [tracking, save],
  );

  const removeJob = useCallback(
    (id: string) => {
      const next = { ...tracking };
      delete next[id];
      save(next);
    },
    [tracking, save],
  );

  const exportBackup = useCallback(() => {
    const blob = new Blob([JSON.stringify({ app: "radar", version: 2, tracking }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `radar-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [tracking]);

  /** Junta o backup com o que já está no navegador; em conflito, vale a mudança mais recente. */
  const importBackup = useCallback(
    async (file: File): Promise<number> => {
      const parsed = JSON.parse(await file.text()) as { tracking?: unknown };
      if (!isTrackingMap(parsed.tracking)) throw new Error("Esse arquivo não é um backup do Radar.");
      const next = { ...tracking };
      let count = 0;
      for (const [id, t] of Object.entries(parsed.tracking)) {
        const current = next[id];
        if (!current || current.statusChangedAt < t.statusChangedAt) {
          next[id] = t;
          count += 1;
        }
      }
      save(next);
      return count;
    },
    [tracking, save],
  );

  return { jobs, ready, lastVisit, updateJob, addManual, removeJob, exportBackup, importBackup };
}
