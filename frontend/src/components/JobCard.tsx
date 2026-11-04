"use client";

import { useDraggable } from "@dnd-kit/core";
import { MapPin } from "lucide-react";
import { CATEGORY_LABEL, LEVEL_LABEL, relativeTime } from "@/lib/labels";
import type { Job } from "@/lib/types";

interface Props {
  job: Job;
  onOpen: (job: Job) => void;
  overlay?: boolean;
}

export function MatchMeter({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <div className="flex items-center gap-2" title="Aderência ao seu perfil, calculada pela IA">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-pannikin" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-mist tabular-nums">{value}%</span>
    </div>
  );
}

export function JobCardBody({ job }: { job: Job }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[13px] font-semibold text-pannikin">{job.company}</span>
        <span className="shrink-0 text-xs text-haze">{relativeTime(job.first_seen)}</span>
      </div>
      <h3 className="mt-1 text-[15px] leading-snug font-medium text-ink">{job.title}</h3>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-mist">
        <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-medium text-ink">{LEVEL_LABEL[job.level]}</span>
        <span className="text-haze">{CATEGORY_LABEL[job.company_category]}</span>
        {job.location && (
          <span className="flex min-w-0 items-center gap-1">
            <MapPin aria-hidden className="size-3 shrink-0" />
            <span className="truncate">{job.location}</span>
          </span>
        )}
      </div>
      {job.ai_match !== null && (
        <div className="mt-3">
          <MatchMeter value={job.ai_match} />
        </div>
      )}
      {!job.is_active && <p className="mt-2 text-xs text-warn">A vaga saiu do ar</p>}
    </>
  );
}

export function JobCard({ job, onOpen, overlay }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: job.id, data: { job } });

  if (overlay) {
    return (
      <div className="w-[288px] rotate-[1.5deg] rounded-xl border border-white/20 bg-[#0b1426] p-3.5 shadow-2xl shadow-black/60">
        <JobCardBody job={job} />
      </div>
    );
  }

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={() => onOpen(job)}
      aria-label={`${job.title}, ${job.company}. Enter para abrir, espaço para mover.`}
      className={`block w-full cursor-grab touch-manipulation rounded-xl border border-white/[0.07] bg-black/30 p-3.5 text-left transition-colors hover:border-white/20 hover:bg-black/40 active:cursor-grabbing ${
        isDragging ? "opacity-30" : ""
      } ${job.is_active ? "" : "opacity-60"}`}
    >
      <JobCardBody job={job} />
    </button>
  );
}
