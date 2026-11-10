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
import { Download, Plus, Search, Upload } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useBoard } from "@/lib/board";
import { CATEGORY_LABEL, LEVEL_LABEL, relativeTime, STATUSES } from "@/lib/labels";
import type { BoardJob, Category, JobsFile, Level, Region, Status } from "@/lib/types";
import { AddJobDialog } from "./AddJobDialog";
import { Column } from "./Column";
import { JobCard } from "./JobCard";
import { JobDrawer } from "./JobDrawer";
import { PipelineBar } from "./PipelineBar";

type Sort = "recent" | "deadline";

const TABS: { id: Region; label: string; caption: string }[] = [
  { id: "br", label: "Brasil", caption: "Big techs, bancos e multinacionais com vaga no país" },
  { id: "intl", label: "Exterior", caption: "Estágio, trainee e júnior fora do Brasil" },
];

const CATEGORY_PLURAL: Record<Category, string> = {
  big_tech: "Big techs",
  bank: "Bancos",
  fintech: "Fintechs",
  multinational: "Multinacionais",
};

export function RadarApp({ data }: { data: JobsFile | null }) {
  const board = useBoard(data);
  const [region, setRegion] = useState<Region>("br");
  const [level, setLevel] = useState<Level | "all">("all");
  const [category, setCategory] = useState<Category | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  // Remoto é requisito, então vem ligado; desligar mostra também presencial e híbrido.
  const [remoteOnly, setRemoteOnly] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<BoardJob | null>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    // Enter abre a vaga; espaço pega o cartão para mover com as setas.
    useSensor(KeyboardSensor, { keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] } }),
  );

  // O filtro de remoto só vale para "Novas": o que você já salvou continua aparecendo.
  const scoped = useMemo(
    () => board.jobs.filter((j) => !remoteOnly || j.remote || j.status !== "new"),
    [board.jobs, remoteOnly],
  );
  const regionJobs = useMemo(() => scoped.filter((j) => j.region === region), [scoped, region]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return regionJobs
      .filter((j) => level === "all" || j.level === level)
      .filter((j) => category === "all" || j.category === category)
      .filter((j) => !q || `${j.title} ${j.company} ${j.location ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === "deadline") return deadlineOrder(a) - deadlineOrder(b);
        return b.statusChangedAt.localeCompare(a.statusChangedAt);
      });
  }, [regionJobs, level, category, query, sort]);

  const byStatus = useMemo(() => {
    const groups = Object.fromEntries(STATUSES.map((s) => [s.id, [] as BoardJob[]])) as Record<Status, BoardJob[]>;
    for (const job of visible) groups[job.status].push(job);
    return groups;
  }, [visible]);

  const counts = useMemo(() => {
    const c: Record<Region, number> = { br: 0, intl: 0 };
    for (const j of scoped) if (j.status === "new") c[j.region] += 1;
    return c;
  }, [scoped]);

  const lastVisit = board.lastVisit;
  const isFresh = useCallback(
    (job: BoardJob) => job.status === "new" && lastVisit !== null && job.firstSeen > lastVisit,
    [lastVisit],
  );

  const openJob = board.jobs.find((j) => j.id === openId) ?? null;
  const closeDrawer = useCallback(() => setOpenId(null), []);
  const closeAdd = useCallback(() => setAdding(false), []);

  const onDragStart = (e: DragStartEvent) => setDragging((e.active.data.current?.job as BoardJob) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const job = e.active.data.current?.job as BoardJob | undefined;
    const target = e.over?.id as Status | undefined;
    if (job && target && target !== job.status) board.updateJob(job.id, { status: target });
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const n = await board.importBackup(file);
      setNotice(
        n === 0
          ? "Backup importado. Nada mudou: o board já estava em dia."
          : `Backup importado: ${n} vagas atualizadas.`,
      );
    } catch (err) {
      setNotice((err as Error).message);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const filtersActive = level !== "all" || category !== "all" || query.trim() !== "";
  const failed = data?.stats.failed.length ?? 0;

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

          <div className="ml-auto flex items-center gap-2 text-sm">
            {data && (
              <span
                className="mr-2 hidden text-mist sm:inline"
                title={failed ? `${failed} fontes não responderam na última coleta` : undefined}
              >
                Atualizado {relativeTime(data.generatedAt)}
              </span>
            )}
            <IconButton label="Exportar backup do board" onClick={board.exportBackup}>
              <Download className="size-4" />
            </IconButton>
            <IconButton label="Importar backup" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" />
            </IconButton>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => onImport(e.target.files?.[0])}
            />
            <button
              onClick={() => setAdding(true)}
              className="ml-1 flex items-center gap-1.5 rounded-lg border border-insignia px-3 py-1.5 font-medium text-ink hover:bg-insignia/30"
            >
              <Plus aria-hidden className="size-4" />
              Adicionar vaga
            </button>
          </div>
        </div>
      </header>

      {notice && (
        <div
          role="status"
          className="mx-5 mt-3 flex items-center justify-between rounded-xl border border-azraq/40 px-4 py-2.5 text-sm text-ink sm:mx-8"
        >
          {notice}
          <button onClick={() => setNotice(null)} className="ml-4 text-mist hover:text-ink">
            Fechar
          </button>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-[1900px] flex-1 flex-col px-5 pt-5 sm:px-8 lg:min-h-0">
        {!data && (
          <p className="mb-5 rounded-xl border border-warn/40 px-4 py-3 text-sm text-warn">
            Ainda não existe coleta. Rode <code className="font-mono">npm run collect</code> e recarregue a página.
            Enquanto isso, dá para adicionar vagas à mão.
          </p>
        )}

        <PipelineBar jobs={regionJobs} />

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            role="switch"
            aria-checked={remoteOnly}
            onClick={() => setRemoteOnly((v) => !v)}
            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors ${
              remoteOnly
                ? "border-insignia bg-insignia/25 font-semibold text-ink"
                : "border-line bg-deep text-mist hover:text-ink"
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
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-haze"
            />
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
            options={[
              { id: "all", label: "Todos" },
              ...(["intern", "trainee", "junior"] as Level[]).map((l) => ({ id: l, label: LEVEL_LABEL[l] })),
            ]}
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
                {CATEGORY_PLURAL[c]}
              </option>
            ))}
          </select>

          <Segmented
            label="Ordenar"
            value={sort}
            onChange={setSort}
            options={[
              { id: "recent", label: "Recentes" },
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

        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragging(null)}
        >
          <div className="board-scroll -mx-5 mt-5 flex items-start gap-3 overflow-x-auto px-5 pb-6 sm:-mx-8 sm:px-8 lg:min-h-0 lg:flex-1">
            {!board.ready ? (
              <p className="text-sm text-mist">Carregando seu board…</p>
            ) : (
              STATUSES.map((s) => (
                <Column
                  key={s.id}
                  status={s.id}
                  label={s.label}
                  hint={s.hint}
                  jobs={byStatus[s.id]}
                  isFresh={isFresh}
                  onOpen={(j) => setOpenId(j.id)}
                />
              ))
            )}
          </div>
          <DragOverlay dropAnimation={null}>
            {dragging ? <JobCard job={dragging} onOpen={() => {}} overlay /> : null}
          </DragOverlay>
        </DndContext>
      </main>

      <JobDrawer job={openJob} onClose={closeDrawer} onUpdate={board.updateJob} onRemove={board.removeJob} />
      <AddJobDialog
        open={adding}
        defaultRegion={region}
        onClose={closeAdd}
        onAdd={(job) => {
          const id = board.addManual(job);
          setRegion(job.region);
          setOpenId(id);
        }}
      />
    </div>
  );
}

// Prazos futuros primeiro (o mais próximo no topo); sem prazo ou já encerrado vai para o fim.
function deadlineOrder(job: BoardJob): number {
  if (!job.deadline) return Number.MAX_SAFE_INTEGER;
  const t = new Date(job.deadline).getTime();
  return t < Date.now() ? Number.MAX_SAFE_INTEGER - 1 : t;
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-lg p-2 text-mist hover:bg-white/5 hover:text-ink"
    >
      {children}
    </button>
  );
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
