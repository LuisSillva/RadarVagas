// Gupy: principal ATS das grandes empresas no Brasil.
//
// Usa a API pública do portal de vagas (a mesma que alimenta portal.gupy.io).
// Ela exige um termo de busca, então rodamos várias buscas de dev e só
// guardamos vagas de empresas que estão na lista (campo `match`).

import type { Level } from "../../src/lib/types";
import { normalize } from "../classify";
import { getJson, parseDate, parseDeadline } from "../http";
import type { CompanySource, RawJob } from "../types";

const API = "https://portal.api.gupy.io/api/v1/jobs";
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

const SEARCH_TERMS = [
  "estágio desenvolvimento",
  "estágio tecnologia",
  "estágio software",
  "estágio dados",
  "estágio TI",
  "desenvolvedor júnior",
  "desenvolvedora júnior",
  "engenharia de software",
  "programa de estágio",
  "trainee tecnologia",
  "jovem aprendiz TI",
  "bolsa tecnologia",
];

const TYPE_TO_LEVEL: Record<string, Level> = {
  vacancy_type_internship: "intern",
  vacancy_type_apprentice: "intern",
  vacancy_type_junior_apprentice: "intern",
  vacancy_type_trainee: "trainee",
};

export interface GupyItem {
  id: number | string;
  name?: string;
  careerPageName?: string;
  careerPageUrl?: string;
  type?: string;
  publishedDate?: string;
  applicationDeadline?: string | null;
  isRemoteWork?: boolean;
  workplaceType?: string;
  city?: string;
  state?: string;
  country?: string;
  jobUrl?: string;
}

export function parseGupyJob(item: GupyItem, company: string): RawJob {
  let location = [item.city, item.state].filter(Boolean).join(", ") || null;
  const remote = Boolean(item.isRemoteWork) || (item.workplaceType ?? "").toLowerCase() === "remote";
  if (remote && !location) location = "Remoto";
  return {
    source: "gupy",
    externalId: String(item.id),
    company,
    title: (item.name ?? "").trim(),
    url: item.jobUrl ?? "",
    location,
    country: item.country || "Brasil",
    remote,
    postedAt: parseDate(item.publishedDate),
    deadline: parseDeadline(item.applicationDeadline),
    levelHint: TYPE_TO_LEVEL[item.type ?? ""] ?? null,
  };
}

export function matchGupyCompany(item: Partial<GupyItem>, sources: CompanySource[]): CompanySource | null {
  const haystack = normalize(`${item.careerPageName ?? ""} ${item.careerPageUrl ?? ""}`);
  for (const src of sources) {
    for (const term of src.match ?? []) {
      // Palavra inteira, para "weg" não casar com "norwegian".
      const escaped = normalize(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`).test(haystack)) return src;
    }
  }
  return null;
}

/** Uma rodada cobre todas as empresas da Gupy. Retorna vagas agrupadas por empresa. */
export async function fetchGupy(sources: CompanySource[]): Promise<Map<string, RawJob[]>> {
  const found = new Map<string, Map<string, RawJob>>(sources.map((s) => [s.company, new Map()]));
  for (const term of SEARCH_TERMS) {
    for (let page = 0; page < MAX_PAGES; page++) {
      const data = await getJson<{ data?: GupyItem[]; pagination?: { total?: number } }>(API, {
        jobName: term,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      const items = data.data ?? [];
      for (const item of items) {
        const src = matchGupyCompany(item, sources);
        if (src) {
          const job = parseGupyJob(item, src.company);
          found.get(src.company)!.set(job.externalId, job);
        }
      }
      const total = data.pagination?.total ?? 0;
      if (items.length < PAGE_SIZE || (page + 1) * PAGE_SIZE >= total) break;
    }
  }
  return new Map([...found].map(([company, jobs]) => [company, [...jobs.values()]]));
}
