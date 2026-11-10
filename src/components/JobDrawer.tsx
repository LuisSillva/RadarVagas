"use client";

import { ExternalLink, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CATEGORY_LABEL, formatDate, LEVEL_LABEL, REGION_LABEL, STATUSES } from "@/lib/labels";
import type { BoardJob, Status } from "@/lib/types";
import { STAGE_COLOR } from "./stage";

interface Props {
  job: BoardJob | null;
  onClose: () => void;
  onUpdate: (id: string, patch: { status?: Status; notes?: string }) => void;
  onRemove: (id: string) => void;
}

export function JobDrawer({ job, onClose, onUpdate, onRemove }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [notes, setNotes] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (job && job.id !== lastJobId) {
    setLastJobId(job.id);
    setNotes(job.notes);
    setSavedAt(null);
    setConfirmRemove(false);
  }

  useEffect(() => {
    if (!job) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [job, onClose]);

  if (!job) return null;

  const manual = job.source === "manual";
  const saveNotes = () => {
    if (notes !== job.notes) {
      onUpdate(job.id, { notes });
      setSavedAt(Date.now());
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button aria-label="Fechar detalhes" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className="relative flex h-full w-full max-w-[460px] flex-col overflow-y-auto border-l border-line bg-deep"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-pannikin">{job.company}</p>
            <h2 id="drawer-title" className="mt-1 text-2xl leading-tight font-semibold text-balance text-ink">
              {job.title}
            </h2>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="rounded-lg p-1.5 text-mist hover:bg-white/10 hover:text-ink"
            aria-label="Fechar"
          >
            <X className="size-5" />
          </button>
        </div>

        <dl className="mx-6 mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Fact term="Nível" value={LEVEL_LABEL[job.level]} />
          <Fact term="Empresa" value={job.category ? CATEGORY_LABEL[job.category] : "Cadastrada por você"} />
          <Fact term="Local" value={job.location ?? "Não informado"} />
          <Fact term="Aba" value={REGION_LABEL[job.region] + (job.remote ? ", remoto" : "")} />
          {!manual && <Fact term="Publicada em" value={formatDate(job.postedAt)} />}
          <Fact term={manual ? "Cadastrada em" : "Encontrada em"} value={formatDate(job.firstSeen)} />
          {job.deadline && <Fact term="Inscrições até" value={formatDate(job.deadline)} />}
        </dl>

        {job.url ? (
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="mx-6 mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-insignia px-4 py-2.5 text-sm font-semibold text-white hover:bg-azraq"
          >
            Abrir vaga no site da empresa
            <ExternalLink aria-hidden className="size-4" />
          </a>
        ) : (
          <p className="mx-6 mt-6 rounded-xl border border-line px-4 py-2.5 text-center text-sm text-mist">Sem link.</p>
        )}

        <section className="mx-6 mt-7">
          <h3 className="text-sm font-semibold text-ink">Etapa</h3>
          <div role="radiogroup" aria-label="Etapa da candidatura" className="mt-2.5 grid grid-cols-3 gap-1.5">
            {STATUSES.map((s) => {
              const active = s.id === job.status;
              return (
                <button
                  key={s.id}
                  role="radio"
                  aria-checked={active}
                  onClick={() => onUpdate(job.id, { status: s.id })}
                  className={`rounded-lg border px-2 py-2 text-[13px] font-medium transition-colors ${
                    active ? "border-pannikin text-white" : "border-line text-mist hover:border-white/25 hover:text-ink"
                  }`}
                  style={active ? { backgroundColor: s.id === "closed" ? "#1b2a4a" : STAGE_COLOR[s.id] } : undefined}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mx-6 mt-7">
          <div className="flex items-baseline justify-between">
            <label htmlFor="notes" className="text-sm font-semibold text-ink">
              Notas
            </label>
            {savedAt && <span className="text-xs text-mist">Notas salvas</span>}
          </div>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setSavedAt(null);
            }}
            onBlur={saveNotes}
            rows={6}
            placeholder="Contato de indicação, datas do processo, o que estudar para a entrevista…"
            className="mt-2.5 w-full resize-y rounded-xl border border-line bg-abyss/60 px-3.5 py-3 text-sm leading-relaxed text-ink placeholder:text-haze focus:border-azraq focus:outline-none"
          />
          <p className="mt-1.5 text-xs text-haze">As notas ficam salvas neste navegador quando você sai do campo.</p>
        </section>

        {manual && (
          <section className="mx-6 mt-6 mb-8">
            {confirmRemove ? (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-mist">Excluir esta vaga do board?</span>
                <button
                  onClick={() => {
                    onRemove(job.id);
                    onClose();
                  }}
                  className="rounded-lg bg-warn/20 px-3 py-1.5 font-semibold text-warn hover:bg-warn/30"
                >
                  Excluir
                </button>
                <button onClick={() => setConfirmRemove(false)} className="text-mist hover:text-ink">
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmRemove(true)}
                className="flex items-center gap-2 text-sm text-mist hover:text-warn"
              >
                <Trash2 aria-hidden className="size-4" />
                Excluir vaga
              </button>
            )}
          </section>
        )}
        {!manual && <div className="mb-8" />}
      </aside>
    </div>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-haze">{term}</dt>
      <dd className="mt-0.5 truncate text-ink">{value}</dd>
    </div>
  );
}
