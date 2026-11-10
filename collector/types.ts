import type { Category, Level } from "../src/lib/types";

export type Ats = "gupy" | "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "workday" | "amazon" | "eightfold";

export interface SourceConfig {
  ats: Ats;
  /** slug do board (greenhouse, lever, ashby...), tenant do Workday ou domínio no Eightfold */
  id?: string;
  /** Gupy: nomes da empresa como aparecem no portal */
  match?: string[];
  options?: { host?: string; site?: string; region?: string; searches?: string[] };
}

export interface Company {
  name: string;
  category: Category;
  sources: SourceConfig[];
}

/** Uma empresa + uma fonte, já "achatado" para o coletor. */
export interface CompanySource extends SourceConfig {
  company: string;
  category: Category;
}

/** Vaga como veio do ATS, já normalizada. A decisão "entra ou não" fica em classify.ts. */
export interface RawJob {
  source: Ats;
  externalId: string;
  company: string;
  title: string;
  url: string;
  location?: string | null;
  country?: string | null;
  remote?: boolean;
  postedAt?: string | null;
  deadline?: string | null;
  /** Dica de nível vinda do próprio ATS (ex.: a Gupy marca estágio no tipo da vaga). */
  levelHint?: Level | null;
}

export class SourceError extends Error {}
