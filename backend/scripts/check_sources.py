"""Testa cada fonte do companies.toml e mostra quantas vagas (e quantas de
entrada) ela devolve. Use quando adicionar uma empresa ou se a coleta
começar a falhar.

    python scripts/check_sources.py            # todas
    python scripts/check_sources.py nubank     # filtra pelo nome
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.classify import classify_dev, classify_level  # noqa: E402
from app.companies import load_sources  # noqa: E402
from app.sources import gupy  # noqa: E402
from app.sources.base import SourceError, make_client  # noqa: E402
from app.sources.boards import FETCHERS  # noqa: E402


def report(name: str, jobs: list) -> None:
    entry = [j for j in jobs if classify_level(j.title, j.level_hint) and classify_dev(j.title) is not False]
    print(f"  ok    {name:<28} {len(jobs):>5} vagas  {len(entry):>4} de entrada")
    for j in entry[:3]:
        print(f"          · {j.title} ({j.location})")


def main() -> int:
    needle = (sys.argv[1] if len(sys.argv) > 1 else "").lower()
    sources = [s for s in load_sources() if needle in s.company.lower()]
    failures = 0
    with make_client() as client:
        gupy_sources = [s for s in sources if s.ats == "gupy"]
        if gupy_sources:
            print("Gupy (busca no portal, filtrada pela lista):")
            try:
                for company, jobs in gupy.fetch_all(client, gupy_sources).items():
                    if jobs:
                        report(company, jobs)
                    else:
                        print(f"  vazio {company:<28} nenhuma vaga de dev agora (ou o match está errado)")
            except SourceError as exc:
                failures += 1
                print(f"  ERRO  gupy: {exc}")
        print("\nBoards:")
        for src in sources:
            if src.ats == "gupy":
                continue
            try:
                report(f"{src.company} [{src.ats}]", FETCHERS[src.ats](client, src))
            except (SourceError, KeyError) as exc:
                failures += 1
                print(f"  ERRO  {src.company} [{src.ats}]: {exc}")
    print(f"\n{failures} fonte(s) com erro.")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
