from pathlib import Path

import yaml

from .sources.base import CompanySource

COMPANIES_FILE = Path(__file__).with_name("companies.yaml")


def load_sources(path: Path = COMPANIES_FILE) -> list[CompanySource]:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    sources: list[CompanySource] = []
    for company in data["companies"]:
        for src in company["sources"]:
            sources.append(
                CompanySource(
                    company=company["name"],
                    category=company["category"],
                    ats=src["ats"],
                    id=src.get("id"),
                    match=src.get("match") or [],
                    options=src.get("options") or {},
                )
            )
    return sources


def category_by_company(sources: list[CompanySource]) -> dict[str, str]:
    return {s.company: s.category for s in sources}
