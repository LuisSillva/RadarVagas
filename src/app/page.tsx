import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { RadarApp } from "@/components/RadarApp";
import type { JobsFile } from "@/lib/types";

// Roda no build: as vagas da última coleta vão direto para o HTML estático.
async function loadJobs(): Promise<JobsFile | null> {
  try {
    return JSON.parse(await readFile(join(process.cwd(), "public", "jobs.json"), "utf8")) as JobsFile;
  } catch {
    return null;
  }
}

export default async function Page() {
  return <RadarApp data={await loadJobs()} />;
}
