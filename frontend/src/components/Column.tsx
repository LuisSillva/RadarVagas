"use client";

import { useDroppable } from "@dnd-kit/core";
import type { Job, Status } from "@/lib/types";
import { JobCard } from "./JobCard";
import { STAGE_COLOR } from "./stage";

interface Props {
  status: Status;
  label: string;
  hint: string;
  jobs: Job[];
  onOpen: (job: Job) => void;
}

const EMPTY: Record<Status, string> = {
  new: "Nada novo desde a última coleta.",
  saved: "Arraste para cá as vagas que valem a candidatura.",
  applied: "Quando enviar uma candidatura, mova a vaga para cá.",
  process: "Testes, cases e entrevistas ficam aqui.",
  offer: "Ainda sem proposta. Ela vem.",
  closed: "Recusas e vagas encerradas.",
};

export function Column({ status, label, hint, jobs, onOpen }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const color = STAGE_COLOR[status];
  const closed = status === "closed";

  return (
    <section
      ref={setNodeRef}
      aria-label={`${label}, ${jobs.length} vagas`}
      className={`flex w-[min(312px,85vw)] shrink-0 flex-col lg:max-h-full rounded-2xl border transition-[box-shadow,border-color] ${
        closed ? "border-line" : "border-white/[0.06]"
      } ${isOver ? "border-pannikin/70 shadow-[0_0_0_1px_var(--color-pannikin)]" : ""}`}
      style={{ backgroundColor: color }}
    >
      <header className="flex items-baseline justify-between px-4 pt-3.5 pb-3" title={hint}>
        <h2 className={`text-[15px] font-semibold ${closed ? "text-haze" : "text-ink"}`}>{label}</h2>
        <span className={`text-sm tabular-nums ${closed ? "text-haze" : "text-mist"}`}>{jobs.length}</span>
      </header>
      <div className="flex min-h-24 flex-col gap-2 overflow-y-auto px-2.5 pb-2.5">
        {jobs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-[13px] text-mist/80">
            {EMPTY[status]}
          </p>
        ) : (
          jobs.map((job) => <JobCard key={job.id} job={job} onOpen={onOpen} />)
        )}
      </div>
    </section>
  );
}
