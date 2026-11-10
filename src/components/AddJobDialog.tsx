"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { NewJob } from "@/lib/board";
import { LEVEL_LABEL, REGION_LABEL } from "@/lib/labels";
import type { Level, Region } from "@/lib/types";

interface Props {
  open: boolean;
  defaultRegion: Region;
  onClose: () => void;
  onAdd: (job: NewJob) => void;
}

const EMPTY = (region: Region): NewJob => ({
  company: "",
  title: "",
  url: "",
  location: "",
  region,
  level: "intern",
  remote: true,
});

// Para vagas que o coletor não pega (LinkedIn, indicação, empresa fora da lista).
export function AddJobDialog({ open, defaultRegion, onClose, onAdd }: Props) {
  const [form, setForm] = useState<NewJob>(EMPTY(defaultRegion));
  const [wasOpen, setWasOpen] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setForm(EMPTY(defaultRegion));
  }

  useEffect(() => {
    if (!open) return;
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = <K extends keyof NewJob>(key: K, value: NewJob[K]) => setForm((f) => ({ ...f, [key]: value }));
  const valid = form.company.trim() && form.title.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Fechar" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-title"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          onAdd(form);
          onClose();
        }}
        className="relative w-full max-w-md rounded-2xl border border-line bg-deep p-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="add-title" className="text-xl font-semibold text-ink">
              Adicionar vaga
            </h2>
            <p className="mt-1 text-sm text-mist">Achou em outro lugar? Ela entra direto em Salvas.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-mist hover:bg-white/10"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 grid gap-3.5">
          <Field label="Empresa">
            <input
              ref={firstRef}
              required
              value={form.company}
              onChange={(e) => set("company", e.target.value)}
              className={INPUT}
            />
          </Field>
          <Field label="Cargo">
            <input
              required
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Estágio em Desenvolvimento"
              className={INPUT}
            />
          </Field>
          <Field label="Link da vaga">
            <input
              type="url"
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://"
              className={INPUT}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nível">
              <select value={form.level} onChange={(e) => set("level", e.target.value as Level)} className={INPUT}>
                {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_LABEL[l]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Aba">
              <select value={form.region} onChange={(e) => set("region", e.target.value as Region)} className={INPUT}>
                {(Object.keys(REGION_LABEL) as Region[]).map((r) => (
                  <option key={r} value={r}>
                    {REGION_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Local (opcional)">
            <input value={form.location} onChange={(e) => set("location", e.target.value)} className={INPUT} />
          </Field>
          <label className="flex items-center gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.remote}
              onChange={(e) => set("remote", e.target.checked)}
              className="size-4 accent-azraq"
            />
            Vaga remota
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-mist hover:text-ink">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!valid}
            className="rounded-xl bg-insignia px-4 py-2 text-sm font-semibold text-white hover:bg-azraq disabled:opacity-40"
          >
            Adicionar
          </button>
        </div>
      </form>
    </div>
  );
}

const INPUT =
  "w-full rounded-xl border border-line bg-abyss/60 px-3 py-2 text-sm text-ink placeholder:text-haze focus:border-azraq focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-mist">{label}</span>
      {children}
    </label>
  );
}
