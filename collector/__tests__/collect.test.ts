import { describe, expect, it } from "vitest";
import type { Job } from "../../src/lib/types";
import { flatten, mergeWithPrevious, toJob } from "../collect";
import { COMPANIES } from "../companies";

const NOW = "2026-11-10T12:00:00.000Z";

const job = (id: string, over: Partial<Job> = {}): Job => ({
  id,
  source: "greenhouse",
  company: "Nubank",
  category: "fintech",
  title: "Software Engineer Intern",
  url: `https://x/${id}`,
  location: "Remote - Brazil",
  region: "br",
  remote: true,
  level: "intern",
  postedAt: null,
  deadline: null,
  firstSeen: NOW,
  lastSeen: NOW,
  active: true,
  ...over,
});

describe("toJob", () => {
  const raw = { source: "greenhouse" as const, externalId: "1", company: "Nubank", url: "https://x" };

  it("aceita estágio de dev e marca região/remoto", () => {
    const j = toJob({ ...raw, title: "Software Engineer Intern", location: "Remote - Brazil" }, "fintech", NOW);
    expect(j).toMatchObject({ id: "greenhouse:1", level: "intern", region: "br", remote: true, active: true });
  });

  it("descarta sênior, fora de tecnologia e vaga sem link", () => {
    expect(toJob({ ...raw, title: "Senior Software Engineer" }, "fintech", NOW)).toBeNull();
    expect(toJob({ ...raw, title: "Estágio em Marketing" }, "fintech", NOW)).toBeNull();
    expect(toJob({ ...raw, title: "Software Engineer Intern", url: "" }, "fintech", NOW)).toBeNull();
  });

  it("mantém título genérico de programa de estágio", () => {
    expect(toJob({ ...raw, title: "Programa de Estágio 2027" }, "fintech", NOW)?.level).toBe("intern");
  });
});

describe("mergeWithPrevious", () => {
  const ok = new Set(["greenhouse|Nubank"]);

  it("preserva a data em que a vaga apareceu", () => {
    const [merged] = mergeWithPrevious([job("a")], [job("a", { firstSeen: "2026-11-01T00:00:00.000Z" })], ok, NOW);
    expect(merged.firstSeen).toBe("2026-11-01T00:00:00.000Z");
    expect(merged.lastSeen).toBe(NOW);
  });

  it("vaga que sumiu de fonte que respondeu vira encerrada", () => {
    const merged = mergeWithPrevious([], [job("a", { lastSeen: "2026-11-09T00:00:00.000Z" })], ok, NOW);
    expect(merged).toHaveLength(1);
    expect(merged[0].active).toBe(false);
  });

  it("encerrada há mais de 30 dias sai do arquivo", () => {
    expect(
      mergeWithPrevious([], [job("a", { lastSeen: "2026-09-01T00:00:00.000Z", active: false })], ok, NOW),
    ).toHaveLength(0);
  });

  it("se a fonte falhou, a vaga continua como estava", () => {
    const merged = mergeWithPrevious([], [job("a", { company: "Stripe" })], ok, NOW);
    expect(merged[0].active).toBe(true);
  });
});

it("lista de empresas é válida", () => {
  const sources = flatten(COMPANIES);
  expect(new Set(COMPANIES.map((c) => c.name)).size).toBe(COMPANIES.length);
  for (const s of sources) {
    if (s.ats === "gupy") expect(s.match?.length).toBeGreaterThan(0);
    else if (s.ats !== "amazon") expect(s.id).toBeTruthy();
    if (s.ats === "workday") expect(s.options?.host && s.options?.site).toBeTruthy();
    if (s.ats === "eightfold") expect(s.options?.host).toBeTruthy();
  }
});
