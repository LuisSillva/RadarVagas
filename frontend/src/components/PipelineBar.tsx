import { STATUSES } from "@/lib/labels";
import type { Job, Status } from "@/lib/types";
import { STAGE_COLOR } from "./stage";

// Resumo do funil: cada etapa ocupa a largura proporcional ao número de vagas,
// na mesma cor da coluna correspondente.
export function PipelineBar({ jobs }: { jobs: Job[] }) {
  const counts = STATUSES.map((s) => ({ ...s, n: jobs.filter((j) => j.status === s.id).length }));
  const inPlay = counts.filter((c) => c.id !== "new" && c.id !== "closed").reduce((a, c) => a + c.n, 0);

  return (
    <div>
      <div className="flex h-3 w-full gap-[3px] overflow-hidden rounded-full" aria-hidden>
        {counts.map((c) =>
          c.n === 0 ? null : (
            <div
              key={c.id}
              className={`h-full first:rounded-l-full last:rounded-r-full ${c.id === "closed" ? "bg-line" : ""}`}
              style={{ flexGrow: c.n, flexBasis: 0, backgroundColor: c.id === "closed" ? undefined : barColor(c.id) }}
            />
          ),
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {counts.map((c) => (
          <li key={c.id} className="flex items-center gap-2 text-mist">
            <span
              aria-hidden
              className={`size-2.5 rounded-full ${c.id === "closed" ? "bg-line" : ""}`}
              style={c.id === "closed" ? undefined : { backgroundColor: barColor(c.id) }}
            />
            {c.label}
            <span className="text-ink tabular-nums">{c.n}</span>
          </li>
        ))}
        <li className="ml-auto text-mist">
          <span className="text-ink tabular-nums">{inPlay}</span> em andamento de {jobs.length}
        </li>
      </ul>
    </div>
  );
}

// "Novas" é quase preto no fundo preto; na barra usamos um tom um pouco acima.
function barColor(id: Status) {
  return id === "new" ? "#1a2c52" : STAGE_COLOR[id];
}
