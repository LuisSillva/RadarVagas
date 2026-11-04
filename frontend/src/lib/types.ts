export type Region = "br" | "intl";
export type Level = "intern" | "trainee" | "junior";
export type Category = "big_tech" | "bank" | "fintech" | "multinational";
export type Status = "new" | "saved" | "applied" | "process" | "offer" | "closed";

export interface Job {
  id: number;
  source: string;
  company: string;
  company_category: Category;
  title: string;
  url: string;
  location: string | null;
  region: Region;
  remote: boolean;
  level: Level;
  posted_at: string | null;
  deadline: string | null;
  first_seen: string;
  is_active: boolean;
  status: Status;
  status_changed_at: string;
  notes: string;
  ai_match: number | null;
  ai_reason: string | null;
}

export interface Summary {
  last_run: { started_at: string; finished_at: string | null; stats: Record<string, number>; errors: string[] } | null;
}

export interface JobPatch {
  status?: Status;
  notes?: string;
}
