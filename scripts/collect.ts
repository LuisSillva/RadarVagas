// Uso: npm run collect
//
// Grava public/jobs.json. Para não perder o histórico (data em que cada vaga
// apareceu, vagas encerradas), parte da coleta anterior: o arquivo local, se
// existir, ou o jobs.json do site publicado (PREVIOUS_JOBS_URL), que é o que o
// GitHub Actions usa.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { collect } from "../collector/collect";
import type { Job, JobsFile } from "../src/lib/types";

const OUTPUT = join(process.cwd(), "public", "jobs.json");

async function loadPrevious(): Promise<Job[]> {
  const url = process.env.PREVIOUS_JOBS_URL;
  if (url) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (res.ok) {
        const data = (await res.json()) as JobsFile;
        console.log(`Coleta anterior: ${data.jobs.length} vagas de ${url}`);
        return data.jobs;
      }
      console.log(`Sem coleta anterior em ${url} (HTTP ${res.status}). Começando do zero.`);
    } catch (err) {
      console.log(`Sem coleta anterior em ${url} (${(err as Error).message}). Começando do zero.`);
    }
    return [];
  }
  try {
    const data = JSON.parse(await readFile(OUTPUT, "utf8")) as JobsFile;
    console.log(`Coleta anterior: ${data.jobs.length} vagas do arquivo local`);
    return data.jobs;
  } catch {
    return [];
  }
}

async function main() {
  const previous = await loadPrevious();
  const result = await collect(previous);
  if (result.stats.answered === 0) {
    console.error("Nenhuma fonte respondeu (sem internet?). Nada foi gravado.");
    process.exit(1);
  }

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(result));

  const active = result.jobs.filter((j) => j.active);
  const count = (pred: (j: Job) => boolean) => active.filter(pred).length;
  console.log(
    [
      "",
      `${result.stats.fetched} vagas lidas, ${result.stats.kept} passaram no filtro.`,
      `Ativas: ${active.length} (Brasil ${count((j) => j.region === "br")}, exterior ${count((j) => j.region === "intl")}, remotas ${count((j) => j.remote)}).`,
      `Fontes que responderam: ${result.stats.answered} de ${result.stats.sources}.`,
      `Gravado em ${OUTPUT}`,
    ].join("\n"),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
