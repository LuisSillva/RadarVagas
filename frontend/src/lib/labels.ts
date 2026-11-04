import type { Category, Level, Region, Status } from "./types";

export const STATUSES: { id: Status; label: string; hint: string }[] = [
  { id: "new", label: "Novas", hint: "Apareceram na coleta e você ainda não olhou." },
  { id: "saved", label: "Salvas", hint: "Vagas que valem a candidatura." },
  { id: "applied", label: "Aplicadas", hint: "Candidatura enviada, aguardando retorno." },
  { id: "process", label: "Em processo", hint: "Teste, case ou entrevista." },
  { id: "offer", label: "Oferta", hint: "Proposta na mesa." },
  { id: "closed", label: "Encerradas", hint: "Recusadas, desistências e vagas que saíram do ar." },
];

export const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.id, s.label])) as Record<Status, string>;

export const LEVEL_LABEL: Record<Level, string> = {
  intern: "Estágio",
  trainee: "Trainee",
  junior: "Júnior",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  big_tech: "Big tech",
  bank: "Banco",
  fintech: "Fintech",
  multinational: "Multinacional",
};

export const REGION_LABEL: Record<Region, string> = {
  br: "Brasil",
  intl: "Exterior",
};

const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "data não informada";
  const diff = new Date(iso).getTime() - now;
  const minutes = Math.round(diff / 60000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(days, "day");
  return rtf.format(Math.round(days / 30), "month");
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
