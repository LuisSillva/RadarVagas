export type Region = "br" | "intl";
export type Level = "intern" | "trainee" | "junior";
export type Category = "big_tech" | "bank" | "fintech" | "multinational";
export type Status = "new" | "saved" | "applied" | "process" | "offer" | "closed";

/** Vaga como sai do coletor (public/jobs.json) ou como você cadastra à mão. */
export interface Job {
  /** `<ats>:<id na fonte>`, ou `manual:<uuid>` */
  id: string;
  source: string;
  company: string;
  category: Category | null;
  title: string;
  url: string;
  location: string | null;
  region: Region;
  remote: boolean;
  level: Level;
  postedAt: string | null;
  deadline: string | null;
  firstSeen: string;
  lastSeen: string;
  /** false quando a vaga sumiu da fonte (encerrada) */
  active: boolean;
}

export interface JobsFile {
  generatedAt: string;
  stats: { sources: number; answered: number; fetched: number; kept: number; failed: string[] };
  jobs: Job[];
}

/** O que você fez com uma vaga. Fica salvo no navegador. */
export interface Tracking {
  status: Status;
  notes: string;
  statusChangedAt: string;
  /** Cópia da vaga, para ela continuar no board mesmo depois de sair do jobs.json. */
  job: Job;
}

export type BoardJob = Job & { status: Status; notes: string; statusChangedAt: string };
