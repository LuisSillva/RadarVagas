"""Gupy: principal ATS das grandes empresas no Brasil.

Usa a API pública do portal de vagas (a mesma que alimenta portal.gupy.io).
Ela exige um termo de busca, então rodamos várias buscas de dev e só
guardamos vagas de empresas que estão na nossa lista (campo `match`).
"""

from __future__ import annotations

import re

import httpx

from .base import CompanySource, RawJob, get_json, parse_dt, strip_html
from ..classify import normalize

API = "https://portal.api.gupy.io/api/v1/jobs"
PAGE_SIZE = 100
MAX_PAGES = 10

SEARCH_TERMS = [
    "estágio desenvolvimento",
    "estágio tecnologia",
    "estágio software",
    "estágio dados",
    "estágio TI",
    "desenvolvedor júnior",
    "desenvolvedora júnior",
    "engenharia de software",
    "programa de estágio",
    "trainee tecnologia",
    "jovem aprendiz TI",
    "bolsa tecnologia",
]

TYPE_TO_LEVEL = {
    "vacancy_type_internship": "intern",
    "vacancy_type_apprentice": "intern",
    "vacancy_type_trainee": "trainee",
    "vacancy_type_junior_apprentice": "intern",
}


def parse_job(item: dict, company: str) -> RawJob:
    city, state = item.get("city"), item.get("state")
    location = ", ".join(p for p in (city, state) if p) or None
    workplace = (item.get("workplaceType") or "").lower()
    remote = bool(item.get("isRemoteWork")) or workplace == "remote"
    if remote and not location:
        location = "Remoto"
    return RawJob(
        source="gupy",
        external_id=str(item["id"]),
        company=company,
        title=item.get("name", "").strip(),
        url=item.get("jobUrl") or "",
        location=location,
        country=item.get("country") or "Brasil",
        remote=remote,
        posted_at=parse_dt(item.get("publishedDate")),
        description=strip_html(item.get("description")),
        level_hint=TYPE_TO_LEVEL.get(item.get("type") or ""),
        extra={"careerPageName": item.get("careerPageName"), "deadline": item.get("applicationDeadline")},
    )


def match_company(item: dict, sources: list[CompanySource]) -> CompanySource | None:
    haystack = normalize(f"{item.get('careerPageName') or ''} {item.get('careerPageUrl') or ''}")
    for src in sources:
        for term in src.match:
            # Palavra inteira, para "weg" não casar com "norwegian".
            if re.search(rf"(?<![a-z0-9]){re.escape(normalize(term))}(?![a-z0-9])", haystack):
                return src
    return None


def fetch_all(client: httpx.Client, sources: list[CompanySource]) -> dict[str, list[RawJob]]:
    """Retorna vagas agrupadas por empresa. Uma rodada cobre todas as empresas da Gupy."""
    found: dict[str, dict[str, RawJob]] = {s.company: {} for s in sources}
    for term in SEARCH_TERMS:
        for page in range(MAX_PAGES):
            data = get_json(client, API, params={"jobName": term, "limit": PAGE_SIZE, "offset": page * PAGE_SIZE})
            items = data.get("data") or []
            for item in items:
                src = match_company(item, sources)
                if src:
                    job = parse_job(item, src.company)
                    found[src.company][job.external_id] = job
            total = (data.get("pagination") or {}).get("total") or 0
            if len(items) < PAGE_SIZE or (page + 1) * PAGE_SIZE >= total:
                break
    return {company: list(jobs.values()) for company, jobs in found.items()}
