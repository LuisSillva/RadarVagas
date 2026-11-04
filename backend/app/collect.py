"""Coletor: busca vagas em todas as fontes, filtra e grava no banco.

Uso:  python -m app.collect            (todas as fontes)
      python -m app.collect --only gupy (uma fonte só, útil para depurar)
"""

from __future__ import annotations

import argparse
import logging
from collections import defaultdict
from collections.abc import Callable, Iterable
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from .ai import Judge
from .classify import classify_dev, classify_level, classify_region, classify_remote
from .companies import load_sources
from .config import get_settings
from .db import SessionLocal, init_db
from .models import CollectionRun, Job, Rejected, Status
from .sources import gupy
from .sources.base import CompanySource, RawJob, SourceError, make_client
from .sources.boards import FETCHERS

log = logging.getLogger("radar.collect")

Fetcher = Callable[[httpx.Client, list[CompanySource]], dict[str, list[RawJob]]]


def fetch_everything(
    client: httpx.Client, sources: list[CompanySource], only: str | None = None
) -> tuple[dict[tuple[str, str], list[RawJob]], list[str]]:
    """Retorna {(ats, empresa): vagas} só das fontes que responderam, e a lista de erros."""
    results: dict[tuple[str, str], list[RawJob]] = {}
    errors: list[str] = []

    gupy_sources = [s for s in sources if s.ats == "gupy"]
    if gupy_sources and only in (None, "gupy"):
        try:
            for company, jobs in gupy.fetch_all(client, gupy_sources).items():
                results[("gupy", company)] = jobs
        except SourceError as exc:
            errors.append(f"gupy: {exc}")

    for src in sources:
        if src.ats == "gupy" or (only and src.ats != only):
            continue
        fetch = FETCHERS.get(src.ats)
        if not fetch:
            errors.append(f"{src.company}: ATS desconhecido '{src.ats}'")
            continue
        try:
            results[(src.ats, src.company)] = fetch(client, src)
        except (SourceError, KeyError) as exc:
            errors.append(f"{src.company} ({src.ats}): {exc}")
    return results, errors


def select_job(
    raw: RawJob, judge: Judge | None, rejected: set[tuple[str, str]] | None = None
) -> tuple[str, int | None, str | None] | None:
    """Decide se a vaga entra. Retorna (nível, aderência, motivo) ou None.

    Quando a IA descarta uma vaga ambígua, ela entra em `rejected` para não ser
    reavaliada (e cobrada) na próxima coleta.
    """
    level = classify_level(raw.title, raw.level_hint)
    is_dev = classify_dev(raw.title)
    if level is None or is_dev is False:
        return None
    if is_dev is None:
        key = (raw.source, raw.external_id)
        if rejected is not None and key in rejected:
            return None
        verdict = judge.evaluate(
            company=raw.company, title=raw.title, location=raw.location, description=raw.description
        ) if judge else None
        if verdict is None:
            return None
        if not verdict.is_dev or verdict.level == "other":
            if rejected is not None:
                rejected.add(key)
            return None
        return level, verdict.match, verdict.reason
    return level, None, None


def upsert(
    session: Session,
    fetched: dict[tuple[str, str], list[RawJob]],
    categories: dict[str, str],
    judge: Judge | None = None,
    now: datetime | None = None,
) -> dict[str, int]:
    now = now or datetime.now(timezone.utc)
    stats = defaultdict(int)
    rejected = {(r.source, r.external_id) for r in session.scalars(select(Rejected))}
    rejected_before = set(rejected)

    for (ats, company), raws in fetched.items():
        existing = {
            j.external_id: j
            for j in session.scalars(select(Job).where(Job.source == ats, Job.company == company))
        }
        seen: set[str] = set()

        for raw in raws:
            stats["fetched"] += 1
            job = existing.get(raw.external_id)
            if job is None:
                decision = select_job(raw, judge, rejected)
                if decision is None:
                    continue
                level, match, reason = decision
                job = Job(
                    source=raw.source,
                    external_id=raw.external_id,
                    company=company,
                    company_category=categories.get(company, "multinational"),
                    level=level,
                    status=Status.NEW,
                    first_seen=now,
                    status_changed_at=now,
                    ai_match=match,
                    ai_reason=reason,
                )
                session.add(job)
                existing[raw.external_id] = job
                stats["new"] += 1
            else:
                stats["updated"] += 1
                if not job.is_active:
                    stats["reopened"] += 1
            seen.add(raw.external_id)
            job.title = raw.title[:300]
            job.url = raw.url
            job.location = raw.location
            job.country = raw.country
            job.region = classify_region(raw)
            job.remote = classify_remote(raw)
            job.description = raw.description
            job.posted_at = raw.posted_at or job.posted_at
            job.deadline = raw.deadline
            job.last_seen = now
            job.is_active = True
            job.closed_at = None

        # A fonte respondeu e a vaga sumiu: ela foi encerrada.
        for ext_id, job in existing.items():
            if ext_id not in seen and job.is_active:
                job.is_active = False
                job.closed_at = now
                stats["closed"] += 1

    for source, external_id in rejected - rejected_before:
        session.add(Rejected(source=source, external_id=external_id))
    session.flush()
    return dict(stats)


def score_new_jobs(session: Session, judge: Judge) -> int:
    """Calcula a aderência das vagas que ainda não têm nota (até o limite da coleta)."""
    scored = 0
    pending: Iterable[Job] = session.scalars(
        select(Job).where(Job.ai_match.is_(None), Job.is_active.is_(True)).order_by(Job.first_seen.desc())
    )
    for job in pending:
        if not judge.enabled:
            break
        verdict = judge.evaluate(
            company=job.company, title=job.title, location=job.location, description=job.description
        )
        if verdict:
            job.ai_match, job.ai_reason = verdict.match, verdict.reason
            scored += 1
    return scored


def run(only: str | None = None) -> CollectionRun:
    settings = get_settings()
    init_db()
    sources = load_sources()
    judge = Judge(settings)

    with SessionLocal() as session:
        record = CollectionRun()
        session.add(record)
        with make_client(settings.http_timeout) as client:
            fetched, errors = fetch_everything(client, sources, only)
        stats = upsert(session, fetched, {s.company: s.category for s in sources}, judge)
        stats["scored"] = score_new_jobs(session, judge) if judge.enabled else 0
        stats["sources_ok"] = len(fetched)
        record.stats, record.errors = stats, errors
        record.finished_at = datetime.now(timezone.utc)
        session.commit()
        return record


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Coleta vagas de estágio e júnior")
    parser.add_argument("--only", help="rodar só um ATS (gupy, greenhouse, lever, ...)")
    args = parser.parse_args()
    record = run(args.only)
    log.info("Coleta concluída: %s", record.stats)
    for err in record.errors:
        log.warning("Fonte com erro: %s", err)


if __name__ == "__main__":
    main()
