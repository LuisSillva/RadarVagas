// Regras que decidem se uma vaga entra no radar.
//
// Três perguntas para cada vaga:
// 1. Qual o nível? (estágio/bolsa, trainee/new grad, júnior, ou fora do escopo)
// 2. É vaga de desenvolvimento/tecnologia?
// 3. É no Brasil ou no exterior? E é remota?

import type { Level, Region } from "../src/lib/types";
import type { RawJob } from "./types";

export function normalize(text: string | null | undefined): string {
  if (!text) return "";
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

const rx = (...patterns: string[]) => new RegExp(patterns.join("|"));

// ------------------------------------------------------------------ nível

const INTERN_RX = rx(
  String.raw`\bestagi\w*`,
  String.raw`\bintern(ship)?s?\b`,
  String.raw`\bco-?op\b`,
  String.raw`\bbolsa\b`,
  String.raw`\bbolsista\w*`,
  String.raw`\baprendiz\w*`,
  String.raw`\bapprentice\w*`,
  String.raw`\bworking student\b`,
  String.raw`\bwerkstudent\w*`,
  String.raw`\bplacement\b`,
  String.raw`\bsummer analyst\b`,
);
const TRAINEE_RX = rx(
  String.raw`\btrainee\b`,
  String.raw`\bnew grad\w*`,
  String.raw`\bgraduate (program|programme|software|engineer|developer|analyst)\b`,
  String.raw`\b(software|engineering|technology|tech) graduate\b`,
  String.raw`\bearly career\b`,
  String.raw`\buniversity grad\w*`,
  String.raw`\brecent grad\w*`,
  String.raw`\bentry[- ]level\b`,
  String.raw`\bcampus\b`,
);
const JUNIOR_RX = rx(
  String.raw`\bjunior\b`,
  String.raw`\bjr\b\.?`,
  String.raw`\b(engineer|developer|desenvolvedor\w*|programmer|sde)\s+i\b`,
  String.raw`\bsde[- ]?1\b`,
  String.raw`\bl3\b`,
  String.raw`\bassociate (software|developer|engineer|data)\b`,
);
const SENIOR_RX = rx(
  String.raw`\bsenior\b`,
  String.raw`\bsr\b\.?`,
  String.raw`\bpleno\b`,
  String.raw`\bstaff\b`,
  String.raw`\bprincipal\b`,
  String.raw`\blead\b`,
  String.raw`\blider\b`,
  String.raw`\bmanager\b`,
  String.raw`\bgerente\b`,
  String.raw`\bdirector\b`,
  String.raw`\bdiretor\w*`,
  String.raw`\bhead\b`,
  String.raw`\bespecialista\b`,
  String.raw`\bcoordenador\w*`,
  String.raw`\barchitect\b`,
  String.raw`\barquitet\w*`,
  String.raw`\b(ii|iii|iv)\b`,
  String.raw`\bsde[- ]?(2|3)\b`,
  String.raw`\bmid[- ]level\b`,
);

/** Retorna intern/trainee/junior, ou null se a vaga não é de entrada. */
export function classifyLevel(title: string, hint?: Level | null): Level | null {
  const t = normalize(title);
  if (hint === "intern" || hint === "trainee") return hint;
  if (INTERN_RX.test(t)) return "intern";
  if (SENIOR_RX.test(t)) return null;
  if (TRAINEE_RX.test(t)) return "trainee";
  if (JUNIOR_RX.test(t) || hint === "junior") return "junior";
  return null;
}

// ------------------------------------------------------------- área de dev

const STRONG_DEV_RX = rx(
  String.raw`\bsoftware\b`,
  String.raw`\bdesenvolv\w*`,
  String.raw`\bdeveloper\w*`,
  String.raw`\bdevelopment engineer\b`,
  String.raw`\bprogramad\w*`,
  String.raw`\bprogramming\b`,
  String.raw`\bback-?end\b`,
  String.raw`\bfront-?end\b`,
  String.raw`\bfull-?\s?stack\b`,
  String.raw`\bmobile\b`,
  String.raw`\b(android|ios)\b`,
  String.raw`\bdevops\b`,
  String.raw`\bsre\b`,
  String.raw`\bsite reliability\b`,
  String.raw`\bmachine learning\b`,
  String.raw`\b(ml|ai) engineer\w*`,
  String.raw`\bengenh\w* de (software|dados|computacao|machine learning|ia)\b`,
  String.raw`\bdata engineer\w*`,
  String.raw`\bsde\b`,
  String.raw`\bswe\b`,
);
const WEAK_DEV_RX = rx(
  String.raw`\btecnologia\b`,
  String.raw`\bti\b`,
  String.raw`\bit\b`,
  String.raw`\bdados\b`,
  String.raw`\bdata\b`,
  String.raw`\bengineer\w*`,
  String.raw`\bengenh\w*`,
  String.raw`\bcloud\b`,
  String.raw`\binfra\w*`,
  String.raw`\bplataforma\b`,
  String.raw`\bplatform\b`,
  String.raw`\bseguranca da informacao\b`,
  String.raw`\b(cyber)?security\b`,
  String.raw`\bqa\b`,
  String.raw`\bquality assurance\b`,
  String.raw`\btest\w* automation\b`,
  String.raw`\bsistemas\b`,
  String.raw`\b(ia|ai)\b`,
  String.raw`\binteligencia artificial\b`,
  String.raw`\bcomputa\w*`,
  String.raw`\bcomputer science\b`,
  String.raw`\btech\b`,
  String.raw`\bdigital\b`,
  String.raw`\banalytics\b`,
);
const NON_DEV_RX = rx(
  String.raw`\bmarketing\b`,
  String.raw`\bvendas\b`,
  String.raw`\bsales\b`,
  String.raw`\bcomercial\b`,
  String.raw`\bjuridic\w*`,
  String.raw`\blegal\b`,
  String.raw`\bfinanc\w*`,
  String.raw`\bcontab\w*`,
  String.raw`\baccount\w*`,
  String.raw`\brecursos humanos\b`,
  String.raw`\b(rh|hr)\b`,
  String.raw`\bpeople\b`,
  String.raw`\brecruit\w*`,
  String.raw`\btalent\b`,
  String.raw`\batendimento\b`,
  String.raw`\bcustomer\b`,
  String.raw`\blogistic\w*`,
  String.raw`\bsupply\b`,
  String.raw`\bcompras\b`,
  String.raw`\bprocurement\b`,
  String.raw`\badministrativ\w*`,
  String.raw`\bcomunicacao\b`,
  String.raw`\bdesign grafico\b`,
  String.raw`\bmerchandis\w*`,
);
// Outras engenharias: "engineering" aparece no título, mas não é software.
const OTHER_ENGINEERING_RX = rx(
  String.raw`\bcivil\b`,
  String.raw`\bmecanic\w*`,
  String.raw`\bmechanical\b`,
  String.raw`\beletric\w*`,
  String.raw`\belectrical\b`,
  String.raw`\bquimic\w*`,
  String.raw`\bchemical\b`,
  String.raw`\bproducao\b`,
  String.raw`\bmanufactur\w*`,
  String.raw`\bhardware\b`,
);

/** "dev" = é de tecnologia, "no" = não é, "maybe" = título genérico ("Programa de Estágio 2027"). */
export function classifyDev(title: string): "dev" | "no" | "maybe" {
  const t = normalize(title);
  if (STRONG_DEV_RX.test(t)) return "dev";
  if (OTHER_ENGINEERING_RX.test(t)) return "no";
  const weak = WEAK_DEV_RX.test(t);
  const nonDev = NON_DEV_RX.test(t);
  if (weak && !nonDev) return "dev";
  if (weak && nonDev) return "maybe";
  if (INTERN_RX.test(t) && isGenericProgram(t)) return "maybe";
  return "no";
}

// "Programa de Estágio 2027", "Summer Internship Program": não diz a área, pode ser de tecnologia.
const GENERIC_WORDS = new Set([
  "programa",
  "program",
  "programme",
  "de",
  "do",
  "da",
  "em",
  "of",
  "the",
  "and",
  "e",
  "estagio",
  "estagiario",
  "estagiaria",
  "estagiario(a)",
  "internship",
  "intern",
  "interns",
  "trainee",
  "bolsa",
  "summer",
  "verao",
  "inverno",
  "winter",
  "fall",
  "spring",
  "talentos",
  "jovens",
  "geral",
  "multiplas",
  "areas",
]);

function isGenericProgram(normalized: string): boolean {
  const words = normalized
    .replace(/[^a-z0-9()\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return words.every((w) => GENERIC_WORDS.has(w) || /^\d{2,4}$/.test(w));
}

// ----------------------------------------------------------------- remoto

const REMOTE_RX = rx(
  String.raw`\bremot[eo]\b`,
  String.raw`\bremotely\b`,
  String.raw`\bhome[- ]?office\b`,
  String.raw`\banywhere\b`,
  String.raw`\bteletrabalho\b`,
  String.raw`\bwork from home\b`,
  String.raw`\bwfh\b`,
  String.raw`\b100% (online|remoto)\b`,
);
const HYBRID_RX = rx(
  String.raw`\bhibrid[oa]\b`,
  String.raw`\bhybrid\b`,
  String.raw`\bpresencial\b`,
  String.raw`\bon-?site\b`,
  String.raw`\bin[- ]office\b`,
);

/** Remoto de verdade: o ATS marcou ou o título/local diz. Híbrido não conta. */
export function classifyRemote(job: Pick<RawJob, "title" | "location" | "remote">): boolean {
  const text = normalize(`${job.title} ${job.location ?? ""}`);
  if (HYBRID_RX.test(text) && !REMOTE_RX.test(normalize(job.location))) return false;
  return Boolean(job.remote) || REMOTE_RX.test(text);
}

// ------------------------------------------------------------------ região

const BR_RX = rx(
  String.raw`\bbrasil\b`,
  String.raw`\bbrazil\b`,
  String.raw`\bsao paulo\b`,
  String.raw`\brio de janeiro\b`,
  String.raw`\bbelo horizonte\b`,
  String.raw`\bcuritiba\b`,
  String.raw`\bporto alegre\b`,
  String.raw`\bflorianopolis\b`,
  String.raw`\brecife\b`,
  String.raw`\bcampinas\b`,
  String.raw`\bbrasilia\b`,
  String.raw`\bsalvador\b`,
  String.raw`\bfortaleza\b`,
  String.raw`\bpasso fundo\b`,
  String.raw`\bjoinville\b`,
  String.raw`\bbarueri\b`,
  String.raw`\bosasco\b`,
  String.raw`\bsao carlos\b`,
  String.raw`\bsao jose dos campos\b`,
  String.raw`,\s*(sp|rj|mg|pr|rs|sc|pe|ba|df|ce|go)\b`,
);

export function classifyRegion(job: Pick<RawJob, "source" | "location" | "country">): Region {
  const country = normalize(job.country);
  if (["br", "bra", "brasil", "brazil"].includes(country)) return "br";
  if (country && country !== "remote") return "intl";
  if (job.source === "gupy") return "br";
  return BR_RX.test(normalize(job.location)) ? "br" : "intl";
}
