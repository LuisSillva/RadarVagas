"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { CATEGORY_LABEL, LEVEL_LABEL, relativeTime, STATUSES } from "@/lib/labels";
import { useRadar } from "@/lib/store";
import type { Category, Job, Level, Region, Status } from "@/lib/types";
import { Column } from "./Column";
import { ConnectDialog } from "./ConnectDialog";
import { JobCard } from "./JobCard";
import { JobDrawer } from "./JobDrawer";
import { PipelineBar } from "./PipelineBar";

type Sort = "recent" | "match" | "deadline";

const TABS: { id: Region; label: string; caption: string }[] = [
  { id: "br", label: "Brasil", caption: "Big techs, bancos e multinacionais com vaga no país" },
  { id: "intl", label: "Exterior", caption: "Estágio, trainee e júnior fora do Brasil" },
];

export function RadarApp() {
  const radar = useRadar();
  const [region, setRegion] = useState<Region>("br");
  const [level, setLevel] = useState<Level | "all">("all");
  const [category, setCategory] = useState<Category | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  // Remoto é requisito, então vem ligado; desligar mostra também presencial e híbrido.
  const [remoteOnly, setRemoteOnly] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [dragging, setDragging] = useState<Job | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    // Enter abre a vaga; espaço pega o cartão para mover com as setas.
    useSensor(KeyboardSensor, { keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] } }),
  );

  const scoped = useMemo(() => radar.jobs.filter((j) => !remoteOnly || j.remote), [radar.jobs, remoteOnly]);
  const regionJobs = useMemo(() => scoped.filter((j) => j.region === region), [scoped, region]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return regionJobs
      .filter((j) => level === "all" || j.level === level)
      .filter((j) => category === "all" || j.company_category === category)
      .filter((j) => !q || `${j.title} ${j.company} ${j.location ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === "match") return (b.ai_match ?? -1) - (a.ai_match ?? -1);
        if (sort === "deadline") return deadlineOrder(a) - deadlineOrder(b);
        return new Date(b.status_changed_at).getTime() - new Date(a.status_changed_at).getTime();
      });
  }, [regionJobs, level, category, query, sort]);

  const byStatus = useMemo(() => {
    const groups = Object.fromEntries(STATUSES.map((s) => [s.id, [] as Job[]])) as Record<Status, Job[]>;
    for (const job of visible) groups[job.status].push(job);
    return groups;
  }, [visible]);

  const counts = useMemo(() => {
    const c: Record<Region, number> = { br: 0, intl: 0 };
    for (const j of scoped) if (j.status === "new" && j.is_active) c[j.region] += 1;
    return c;
  }, [scoped]);

  const openJob = radar.jobs.find((j) => j.id === openId) ?? null;
  const closeDrawer = useCallback(() => setOpenId(null), []);

  const onDragStart = (e: DragStartEvent) => setDragging((e.active.data.current?.job as Job) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const job = e.active.data.current?.job as Job | undefined;
    const target = e.over?.id as Status | undefined;
    if (job && target && target !== job.status) radar.updateJob(job.id, { status: target });
  };

  const filtersActive = level !== "all" || category !== "all" || query.trim() !== "";
  const lastRun = radar.summary?.last_run?.finished_at;

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1900px] flex-wrap items-center gap-x-8 gap-y-3 px-5 pt-5 pb-4 sm:px-8">
          <div className="flex items-baseline gap-3">
            <h1 className="text-[28px] leading-none font-bold tracking-[-0.02em] text-ink">Radar</h1>
            <p className="hidden text-sm text-mist md:block">vagas de estágio e júnior em empresas grandes</p>
          </div>

          <nav role="tablist" aria-label="Região das vagas" className="flex gap-1 rounded-xl bg-deep p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={region === t.id}
                title={t.caption}
                onClick={() => setRegion(t.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                  region === t.id ? "bg-insignia text-white" : "text-mist hover:text-ink"
                }`}
              >
                {t.label}
                {counts[t.id] > 0 && (
                  <span
                    className={`rounded-md px-1.5 text-xs tabular-nums ${region === t.id ? "bg-white/20" : "bg-white/10"}`}
                    aria-label={`${counts[t.id]} novas`}
                  >
                    {counts[t.id]}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4 text-sm">
            {lastRun && <span className="hidden text-mist sm:inline">Última coleta {relativeTime(lastRun)}</span>}
            {radar.mode === "live" ? (
              <button onClick={radar.disconnect} className="rounded-lg px-3 py-1.5 text-mist hover:bg-white/5 hover:text-ink">
                Desconectar
              </button>
            ) : (
              <button
                onClick={() => setConnectOpen(true)}
                className="rounded-lg border border-insignia px-3 py-1.5 font-medium text-ink hover:bg-insignia/30"
              >
                Conectar API
              </button>
            )}
          </div>
        </div>

        {radar.mode === "demo" && (
          <div className="mx-auto max-w-[1900px] px-5 pb-3 sm:px-8">
            <p className="text-[13px] text-mist">
              Modo demonstração com vagas de exemplo. Mover cartões e escrever notas funciona e fica salvo neste navegador.{" "}
              <button onClick={radar.resetDemo} className="text-pannikin underline-offset-2 hover:underline">
                Restaurar exemplo
              </button>
            </p>
          </div>
        )}
      </header>

      {radar.error && (
        <div role="alert" className="mx-5 mt-3 flex items-center justify-between rounded-xl border border-warn/40 px-4 py-2.5 text-sm text-warn sm:mx-8">
          {radar.error}
          <button onClick={radar.clearError} className="ml-4 text-mist hover:text-ink">
            Fechar
          </button>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-[1900px] flex-1 flex-col px-5 pt-5 sm:px-8 lg:min-h-0">
        <PipelineBar jobs={regionJobs} />

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            role="switch"
            aria-checked={remoteOnly}
            onClick={() => setRemoteOnly((v) => !v)}
            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors ${
              remoteOnly ? "border-insignia bg-insignia/25 font-semibold text-ink" : "border-line bg-deep text-mist hover:text-ink"
            }`}
          >
            <span
              aria-hidden
              className={`relative h-4 w-7 rounded-full transition-colors ${remoteOnly ? "bg-azraq" : "bg-line"}`}
            >
              <span
                className={`absolute top-0.5 size-3 rounded-full bg-ink transition-[left] ${remoteOnly ? "left-3.5" : "left-0.5"}`}
              />
            </span>
            Só remoto
          </button>

          <label className="relative min-w-[240px] flex-1 sm:max-w-sm">
            <span className="sr-only">Buscar vaga, empresa ou cidade</span>
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-haze" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar vaga, empresa ou cidade"
              className="w-full rounded-xl border border-line bg-deep py-2 pr-3 pl-9 text-sm text-ink placeholder:text-haze focus:border-azraq focus:outline-none"
            />
          </label>

          <Segmented
            label="Nível"
            value={level}
            onChange={setLevel}
            options={[{ id: "all", label: "Todos" }, ...(["intern", "trainee", "junior"] as Level[]).map((l) => ({ id: l, label: LEVEL_LABEL[l] }))]}
          />

          <select
            aria-label="Tipo de empresa"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category | "all")}
            className="rounded-xl border border-line bg-deep px-3 py-2 text-sm text-ink focus:border-azraq focus:outline-none"
          >
            <option value="all">Todas as empresas</option>
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c] === "Banco" ? "Bancos" : CATEGORY_LABEL[c] + "s"}
              </option>
            ))}
          </select>

          <Segmented
            label="Ordenar"
            value={sort}
            onChange={setSort}
            options={[
              { id: "recent", label: "Recentes" },
              { id: "match", label: "Aderência" },
              { id: "deadline", label: "Prazo" },
            ]}
          />

          {filtersActive && (
            <button
              onClick={() => {
                setLevel("all");
                setCategory("all");
                setQuery("");
              }}
              className="text-sm text-pannikin hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </div>

        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          <div className="board-scroll -mx-5 mt-5 flex items-start gap-3 overflow-x-auto px-5 pb-6 sm:-mx-8 sm:px-8 lg:min-h-0 lg:flex-1">
            {radar.mode === "loading" ? (
              <p className="text-sm text-mist">Carregando vagas…</p>
            ) : (
              STATUSES.map((s) => (
                <Column key={s.id} status={s.id} label={s.label} hint={s.hint} jobs={byStatus[s.id]} onOpen={(j) => setOpenId(j.id)} />
              ))
            )}
          </div>
          <DragOverlay dropAnimation={null}>{dragging ? <JobCard job={dragging} onOpen={() => {}} overlay /> : null}</DragOverlay>
        </DndContext>
      </main>

      <JobDrawer job={openJob} demo={radar.mode === "demo"} onClose={closeDrawer} onUpdate={radar.updateJob} />
      <ConnectDialog open={connectOpen} hasApi={radar.hasApi} onClose={() => setConnectOpen(false)} onConnect={radar.connect} />
    </div>
  );
}

// Prazos futuros primeiro (o mais próximo no topo); sem prazo ou já encerrado vai para o fim.
function deadlineOrder(job: Job): number {
  if (!job.deadline) return Number.MAX_SAFE_INTEGER;
  const t = new Date(job.deadline).getTime();
  return t < Date.now() ? Number.MAX_SAFE_INTEGER - 1 : t;
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl border border-line bg-deep p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-[10px] px-3 py-1.5 text-sm transition-colors ${
            value === o.id ? "bg-tyrian font-semibold text-ink" : "text-mist hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
