import { SourceError } from "./types";

const USER_AGENT = "RadarDeVagas/2.0 (projeto pessoal; github.com/LuisSillva/RadarVagas)";
const TIMEOUT_MS = 20_000;

async function request<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...init.headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new SourceError(`${init.method ?? "GET"} ${url}: ${(err as Error).message}`);
  }
  if (!res.ok) throw new SourceError(`${init.method ?? "GET"} ${url}: HTTP ${res.status}`);
  try {
    return (await res.json()) as T;
  } catch {
    throw new SourceError(`${url}: resposta não é JSON`);
  }
}

export function getJson<T = unknown>(url: string, params?: Record<string, string | number>): Promise<T> {
  const full = params ? `${url}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}` : url;
  return request<T>(full, { method: "GET" });
}

export function postJson<T = unknown>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

/** Converte ISO 8601 (com ou sem fuso) ou timestamp em ms para ISO UTC. */
export function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const date = typeof value === "number" ? new Date(value) : new Date(String(value).trim());
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Prazo só com data ("2026-11-30") vale até o fim do dia no horário de Brasília. */
export function parseDeadline(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return parseDate(`${text}T23:59:59-03:00`);
  return parseDate(text);
}

/** Roda `fn` em todos os itens com no máximo `limit` ao mesmo tempo. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}
