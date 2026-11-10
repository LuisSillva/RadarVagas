// Orquestra a coleta: busca em todas as fontes, filtra pelas regras e junta
// com a coleta anterior para manter a data em que cada vaga apareceu e marcar
// as que saíram do ar.

import type { Job, JobsFile } from "../src/lib/types";
import { classifyDev, classifyLevel, classifyRegion, classifyRemote } from "./classify";
import { COMPANIES } from "./companies";
import { mapLimit } from "./http";
import { FETCHERS } from "./sources/boards";
import { fetchGupy } from "./sources/gupy";
import type { Company, CompanySource, RawJob } from "./types";

/** Vaga encerrada continua no arquivo por esse tempo, para o board conseguir mostrar o aviso. */
const KEEP_CLOSED_DAYS = 30;

export function flatten(companies: Company[]): CompanySource[] {
  return companies.flatMap((c) => c.sources.map((s) => ({ ...s, company: c.name, category: c.category })));
}

const sourceKey = (ats: string, company: string) => `${ats}|${company}`;

export interface FetchResult {
  /** vagas por fonte que respondeu (`ats|empresa`) */
  bySource: Map<string, RawJob[]>;
  failed: string[];
}

export async function fetchEverything(sources: CompanySource[], log = console.log): Promise<FetchResult> {
  const bySource = new Map<string, RawJob[]>();
  const failed: string[] = [];

  const gupySources = sources.filter((s) => s.ats === "gupy");
  const others = sources.filter((s) => s.ats !== "gupy");

  const gupyTask = (async () => {
    if (gupySources.length === 0) return;
    try {
      for (const [company, jobs] of await fetchGupy(gupySources)) bySource.set(sourceKey("gupy", company), jobs);
      log(`gupy: ok (${gupySources.length} empresas)`);
    } catch (err) {
      failed.push(`Gupy: ${(err as Error).message}`);
      log(`gupy: FALHOU ${(err as Error).message}`);
    }
  })();

  const othersTask = mapLimit(others, 6, async (src) => {
    const fetch = FETCHERS[src.ats];
    try {
      if (!fetch) throw new Error(`ATS desconhecido "${src.ats}"`);
      const jobs = await fetch(src);
      bySource.set(sourceKey(src.ats, src.company), jobs);
      log(`${src.company} (${src.ats}): ${jobs.length} vagas`);
    } catch (err) {
      failed.push(`${src.company} (${src.ats}): ${(err as Error).message}`);
      log(`${src.company} (${src.ats}): FALHOU ${(err as Error).message}`);
    }
  });

  await Promise.all([gupyTask, othersTask]);
  return { bySource, failed: failed.sort() };
}

/** Decide se a vaga entra. Títulos genéricos ("Programa de Estágio 2027") entram: melhor ver a mais do que perder. */
export function toJob(raw: RawJob, category: Job["category"], now: string): Job | null {
  const level = classifyLevel(raw.title, raw.levelHint);
  if (!level || classifyDev(raw.title) === "no" || !raw.url) return null;
  return {
    id: `${raw.source}:${raw.externalId}`,
    source: raw.source,
    company: raw.company,
    category,
    title: raw.title,
    url: raw.url,
    location: raw.location ?? null,
    region: classifyRegion(raw),
    remote: classifyRemote(raw),
    level,
    postedAt: raw.postedAt ?? null,
    deadline: raw.deadline ?? null,
    firstSeen: now,
    lastSeen: now,
    active: true,
  };
}

/**
 * Junta a coleta atual com a anterior:
 * - vaga que já existia mantém o firstSeen;
 * - vaga que sumiu de uma fonte que respondeu vira encerrada (e some depois de 30 dias);
 * - vaga de uma fonte que falhou agora é mantida como estava, para uma queda não "encerrar" tudo.
 */
export function mergeWithPrevious(current: Job[], previous: Job[], okSources: Set<string>, now: string): Job[] {
  const prevById = new Map(previous.map((j) => [j.id, j]));
  const merged = new Map<string, Job>();

  for (const job of current) {
    const prev = prevById.get(job.id);
    merged.set(job.id, prev ? { ...job, firstSeen: prev.firstSeen } : job);
  }

  const cutoff = new Date(now).getTime() - KEEP_CLOSED_DAYS * 86_400_000;
  for (const prev of previous) {
    if (merged.has(prev.id)) continue;
    const sourceAnswered = okSources.has(sourceKey(prev.source, prev.company));
    if (!sourceAnswered) {
      merged.set(prev.id, prev);
    } else if (new Date(prev.lastSeen).getTime() >= cutoff) {
      merged.set(prev.id, { ...prev, active: false });
    }
  }

  return [...merged.values()].sort(
    (a, b) => b.firstSeen.localeCompare(a.firstSeen) || a.company.localeCompare(b.company),
  );
}

export async function collect(previous: Job[], log = console.log): Promise<JobsFile> {
  const now = new Date().toISOString();
  const sources = flatten(COMPANIES);
  const categories = new Map(COMPANIES.map((c) => [c.name, c.category]));
  const { bySource, failed } = await fetchEverything(sources, log);

  let fetched = 0;
  const current = new Map<string, Job>();
  for (const jobs of bySource.values()) {
    fetched += jobs.length;
    for (const raw of jobs) {
      const job = toJob(raw, categories.get(raw.company) ?? null, now);
      if (job) current.set(job.id, job);
    }
  }

  const jobs = mergeWithPrevious([...current.values()], previous, new Set(bySource.keys()), now);
  return {
    generatedAt: now,
    stats: { sources: sources.length, answered: bySource.size, fetched, kept: current.size, failed },
    jobs,
  };
}
