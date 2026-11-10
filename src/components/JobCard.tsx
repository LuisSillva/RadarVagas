"use client";

import { useDraggable } from "@dnd-kit/core";
import { Clock, MapPin, Wifi } from "lucide-react";
import { CATEGORY_LABEL, deadlineInfo, type DeadlineTone, LEVEL_LABEL, relativeTime } from "@/lib/labels";
import type { BoardJob } from "@/lib/types";

interface Props {
  job: BoardJob;
  fresh?: boolean;
  onOpen: (job: BoardJob) => void;
  overlay?: boolean;
}

const DEADLINE_STYLE: Record<DeadlineTone, string> = {
  urgent: "text-warn font-semibold",
  soon: "text-warn",
  normal: "text-mist",
  past: "text-haze line-through",
};

// O prazo só importa antes de se candidatar.
const SHOWS_DEADLINE = new Set(["new", "saved"]);

export function JobCardBody({ job, fresh }: { job: BoardJob; fresh?: boolean }) {
  const deadline = SHOWS_DEADLINE.has(job.status) ? deadlineInfo(job.deadline) : null;
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[13px] font-semibold text-pannikin">{job.company}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-haze">
          {fresh && (
            <span className="rounded-md bg-azraq/30 px-1.5 py-px text-[11px] font-semibold text-ink">nova</span>
          )}
          {job.source === "manual" ? "sua" : relativeTime(job.firstSeen)}
        </span>
      </div>
      <h3 className="mt-1 text-[15px] leading-snug font-medium text-ink">{job.title}</h3>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-mist">
        <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-medium text-ink">{LEVEL_LABEL[job.level]}</span>
        {job.remote && (
          <span className="flex items-center gap-1 text-ink">
            <Wifi aria-hidden className="size-3" />
            Remoto
          </span>
        )}
        {job.category && <span className="text-haze">{CATEGORY_LABEL[job.category]}</span>}
        {job.location && !(job.remote && /^(remot[eo]|anywhere)$/i.test(job.location.trim())) && (
          <span className="flex min-w-0 items-center gap-1">
            <MapPin aria-hidden className="size-3 shrink-0" />
            <span className="truncate">{job.location}</span>
          </span>
        )}
      </div>
      {deadline && (
        <p className={`mt-2 flex items-center gap-1.5 text-xs ${DEADLINE_STYLE[deadline.tone]}`}>
          <Clock aria-hidden className="size-3 shrink-0" />
          {deadline.text}
        </p>
      )}
      {!job.active && <p className="mt-2 text-xs text-warn">A vaga saiu do ar</p>}
    </>
  );
}

export function JobCard({ job, fresh, onOpen, overlay }: Props) {
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
      } ${job.active ? "" : "opacity-60"}`}
    >
      <JobCardBody job={job} fresh={fresh} />
    </button>
  );
}
