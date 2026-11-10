// Adaptadores dos boards públicos: Greenhouse, Lever, Ashby, SmartRecruiters,
// Workday, Amazon e Eightfold. Cada um tem uma função `parse*` pura (testada
// com payloads reais) e uma `fetch*` que faz as requisições.

/* eslint-disable @typescript-eslint/no-explicit-any -- payloads externos, lidos campo a campo */

import { getJson, parseDate, postJson } from "../http";
import { SourceError, type CompanySource, type RawJob } from "../types";

const has = (text: unknown, word: string) =>
  String(text ?? "")
    .toLowerCase()
    .includes(word);

// ---------------------------------------------------------------- Greenhouse

export function parseGreenhouse(data: any, company: string): RawJob[] {
  return (data?.jobs ?? []).map((item: any): RawJob => {
    const location = item.location?.name ?? null;
    return {
      source: "greenhouse",
      externalId: String(item.id),
      company,
      title: String(item.title ?? "").trim(),
      url: item.absolute_url ?? "",
      location,
      remote: has(location, "remote"),
      postedAt: parseDate(item.first_published ?? item.updated_at),
    };
  });
}

async function fetchGreenhouse(src: CompanySource) {
  return parseGreenhouse(await getJson(`https://boards-api.greenhouse.io/v1/boards/${src.id}/jobs`), src.company);
}

// --------------------------------------------------------------------- Lever

export function parseLever(data: any, company: string): RawJob[] {
  return (Array.isArray(data) ? data : []).map((item: any): RawJob => {
    const cats = item.categories ?? {};
    const location = cats.location || (cats.allLocations ?? []).join(", ") || null;
    return {
      source: "lever",
      externalId: String(item.id),
      company,
      title: String(item.text ?? "").trim(),
      url: item.hostedUrl ?? "",
      location,
      country: item.country ?? null,
      remote: item.workplaceType === "remote" || has(location, "remote"),
      postedAt: parseDate(item.createdAt),
      levelHint: has(cats.commitment, "intern") ? "intern" : null,
    };
  });
}

async function fetchLever(src: CompanySource) {
  const host = src.options?.region === "eu" ? "api.eu.lever.co" : "api.lever.co";
  return parseLever(await getJson(`https://${host}/v0/postings/${src.id}`, { mode: "json" }), src.company);
}

// --------------------------------------------------------------------- Ashby

export function parseAshby(data: any, company: string): RawJob[] {
  return (data?.jobs ?? [])
    .filter((item: any) => item.isListed !== false)
    .map((item: any): RawJob => ({
      source: "ashby",
      externalId: String(item.id ?? item.jobUrl),
      company,
      title: String(item.title ?? "").trim(),
      url: item.jobUrl ?? item.applyUrl ?? "",
      location: item.location ?? null,
      country: item.address?.postalAddress?.addressCountry ?? null,
      remote: Boolean(item.isRemote) || String(item.workplaceType ?? "").toLowerCase() === "remote",
      postedAt: parseDate(item.publishedAt),
      levelHint: String(item.employmentType ?? "").toLowerCase() === "intern" ? "intern" : null,
    }));
}

async function fetchAshby(src: CompanySource) {
  return parseAshby(await getJson(`https://api.ashbyhq.com/posting-api/job-board/${src.id}`), src.company);
}

// ----------------------------------------------------------- SmartRecruiters

const SR_LEVELS: Record<string, "intern" | "junior"> = { internship: "intern", entry_level: "junior" };

export function parseSmartRecruiters(data: any, company: string): RawJob[] {
  return (data?.content ?? []).map((item: any): RawJob => {
    const loc = item.location ?? {};
    const location = loc.fullLocation || [loc.city, loc.region, loc.country].filter(Boolean).join(", ") || null;
    return {
      source: "smartrecruiters",
      externalId: String(item.id),
      company,
      title: String(item.name ?? "").trim(),
      url: `https://jobs.smartrecruiters.com/${item.company?.identifier ?? ""}/${item.id}`,
      location,
      country: loc.country ? String(loc.country).toUpperCase() : null,
      remote: Boolean(loc.remote),
      postedAt: parseDate(item.releasedDate),
      levelHint: SR_LEVELS[String(item.experienceLevel?.id ?? "").toLowerCase()] ?? null,
    };
  });
}

async function fetchSmartRecruiters(src: CompanySource) {
  const jobs: RawJob[] = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const data: any = await getJson(`https://api.smartrecruiters.com/v1/companies/${src.id}/postings`, {
      limit: 100,
      offset,
    });
    jobs.push(...parseSmartRecruiters(data, src.company));
    if (offset + 100 >= Number(data?.totalFound ?? 0)) break;
  }
  return jobs;
}

// ------------------------------------------------------------------- Workday
// Muitos bancos e multinacionais usam Workday. O site de carreiras tem um
// endpoint JSON interno (cxs). id = tenant; options: host (wd1, wd5...) e site.

const WORKDAY_SEARCHES = ["intern", "internship", "estágio", "junior", "new grad", "graduate", "early career"];

export function parseWorkday(data: any, company: string, baseUrl: string): RawJob[] {
  return (data?.jobPostings ?? [])
    .filter((item: any) => item.externalPath)
    .map((item: any): RawJob => {
      const path: string = item.externalPath;
      return {
        source: "workday",
        externalId: `${company}:${path.includes("_") ? path.slice(path.lastIndexOf("_") + 1) : path}`,
        company,
        title: String(item.title ?? "").trim(),
        url: `${baseUrl}${path}`,
        location: item.locationsText ?? null,
        remote: String(item.remoteType ?? "").toLowerCase() === "remote" || has(item.locationsText, "remote"),
      };
    });
}

async function fetchWorkday(src: CompanySource) {
  const { host, site } = src.options ?? {};
  if (!host || !site) throw new SourceError("workday precisa de options.host e options.site");
  const api = `https://${src.id}.${host}.myworkdayjobs.com/wday/cxs/${src.id}/${site}/jobs`;
  const baseUrl = `https://${src.id}.${host}.myworkdayjobs.com/${site}`;
  const seen = new Map<string, RawJob>();
  for (const searchText of src.options?.searches ?? WORKDAY_SEARCHES) {
    for (let offset = 0; offset < 200; offset += 20) {
      const batch = parseWorkday(
        await postJson(api, { appliedFacets: {}, limit: 20, offset, searchText }),
        src.company,
        baseUrl,
      );
      for (const job of batch) seen.set(job.externalId, job);
      if (batch.length < 20) break;
    }
  }
  return [...seen.values()];
}

// -------------------------------------------------------------------- Amazon

export function parseAmazon(data: any, company: string): RawJob[] {
  return (data?.jobs ?? []).map((item: any): RawJob => ({
    source: "amazon",
    externalId: String(item.id_icims ?? item.id),
    company,
    title: String(item.title ?? "").trim(),
    url: `https://www.amazon.jobs${item.job_path ?? ""}`,
    location: item.normalized_location ?? item.location ?? null,
    country: item.country_code ?? null,
    postedAt: parseDate(item.posted_date),
  }));
}

async function fetchAmazon(src: CompanySource) {
  const seen = new Map<string, RawJob>();
  for (const term of [
    "software development engineer intern",
    "software engineer intern",
    "new grad software",
    "estágio",
  ]) {
    const data = await getJson("https://www.amazon.jobs/en/search.json", {
      base_query: term,
      result_limit: 100,
      offset: 0,
      sort: "recent",
    });
    for (const job of parseAmazon(data, src.company)) seen.set(job.externalId, job);
  }
  return [...seen.values()];
}

// ------------------------------------------------------------------ Eightfold
// Usado por Microsoft, Netflix, Qualcomm e outras. Existem duas versões da API:
// a nova (pcsx) e a antiga (apply/v2); tentamos a nova e caímos na antiga.
// id = domínio da empresa, options.host = site de carreiras.

const EIGHTFOLD_SEARCHES = ["intern", "internship", "new grad", "junior", "estágio"];

export function parseEightfold(data: any, company: string, host: string): RawJob[] {
  const payload = data?.data && typeof data.data === "object" ? data.data : data;
  return (payload?.positions ?? []).map((item: any): RawJob => {
    const locations: string[] = item.locations ?? (item.location ? [item.location] : []);
    let url: string = item.canonicalPositionUrl ?? item.positionUrl ?? `/careers/job/${item.id}`;
    if (url.startsWith("/")) url = `https://${host}${url}`;
    const posted = item.postedTs ?? item.t_create ?? item.t_update;
    const option = String(item.workLocationOption ?? item.work_location_option ?? "").toLowerCase();
    return {
      source: "eightfold",
      externalId: `${company}:${item.atsJobId ?? item.ats_job_id ?? item.id}`,
      company,
      title: String(item.name ?? item.title ?? "").trim(),
      url,
      location: locations.slice(0, 3).join("; ") || null,
      remote: option === "remote" || Boolean(item.isRemote),
      postedAt: typeof posted === "number" ? parseDate(posted * 1000) : parseDate(posted),
    };
  });
}

async function fetchEightfold(src: CompanySource) {
  const host = src.options?.host;
  if (!host) throw new SourceError("eightfold precisa de options.host");
  let lastError: unknown;
  for (const endpoint of [`https://${host}/api/pcsx/search`, `https://${host}/api/apply/v2/jobs`]) {
    const seen = new Map<string, RawJob>();
    try {
      for (const query of src.options?.searches ?? EIGHTFOLD_SEARCHES) {
        for (let start = 0; start < 100; start += 10) {
          const data = await getJson(endpoint, { domain: src.id ?? "", query, start, num: 10 });
          const batch = parseEightfold(data, src.company, host);
          for (const job of batch) seen.set(job.externalId, job);
          if (batch.length < 10) break;
        }
      }
      return [...seen.values()];
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new SourceError(`eightfold ${host}: sem resposta`);
}

export const FETCHERS: Record<string, (src: CompanySource) => Promise<RawJob[]>> = {
  greenhouse: fetchGreenhouse,
  lever: fetchLever,
  ashby: fetchAshby,
  smartrecruiters: fetchSmartRecruiters,
  workday: fetchWorkday,
  amazon: fetchAmazon,
  eightfold: fetchEightfold,
};
