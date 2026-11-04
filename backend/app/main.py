from __future__ import annotations

import hmac
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_serializer
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .config import Settings, get_settings
from .db import get_session, init_db
from .models import CollectionRun, Job, Status


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Radar de Vagas", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().origins,
    allow_methods=["GET", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

SessionDep = Annotated[Session, Depends(get_session)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


# ------------------------------------------------------------------ auth


def _token_ok(authorization: str | None, settings: Settings) -> bool:
    if not authorization or not authorization.lower().startswith("bearer "):
        return False
    return hmac.compare_digest(authorization[7:].strip(), settings.admin_token)


def require_owner(settings: SettingsDep, authorization: Annotated[str | None, Header()] = None) -> None:
    if not _token_ok(authorization, settings):
        raise HTTPException(status_code=401, detail="Token inválido ou ausente.")


def require_reader(settings: SettingsDep, authorization: Annotated[str | None, Header()] = None) -> None:
    if settings.public_read:
        return
    require_owner(settings, authorization)


# --------------------------------------------------------------- schemas


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    company: str
    company_category: str
    title: str
    url: str
    location: str | None
    region: str
    remote: bool
    level: str
    posted_at: datetime | None
    deadline: datetime | None
    first_seen: datetime
    is_active: bool
    status: str
    status_changed_at: datetime
    notes: str
    ai_match: int | None
    ai_reason: str | None


    # O SQLite devolve datas sem fuso; tudo é gravado em UTC, então marcamos como UTC.
    @field_serializer("posted_at", "deadline", "first_seen", "status_changed_at")
    def _as_utc(self, value: datetime | None) -> str | None:
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()


class JobPatch(BaseModel):
    status: Status | None = None
    notes: str | None = Field(default=None, max_length=5000)


class RunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    started_at: datetime
    finished_at: datetime | None
    stats: dict
    errors: list


class Summary(BaseModel):
    last_run: RunOut | None
    counts: dict[str, dict[str, int]]
    companies: list[str]


# ------------------------------------------------------------- endpoints


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.get("/api/auth", dependencies=[Depends(require_owner)])
def check_auth() -> dict:
    return {"ok": True}


@app.get("/api/jobs", response_model=list[JobOut], dependencies=[Depends(require_reader)])
def list_jobs(
    session: SessionDep,
    region: Literal["br", "intl"] | None = None,
    level: Literal["intern", "trainee", "junior"] | None = None,
    category: str | None = None,
    remote: bool | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    include_closed: bool = False,
) -> list[Job]:
    stmt = select(Job)
    if region:
        stmt = stmt.where(Job.region == region)
    if level:
        stmt = stmt.where(Job.level == level)
    if category:
        stmt = stmt.where(Job.company_category == category)
    if remote is not None:
        stmt = stmt.where(Job.remote.is_(remote))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Job.title.ilike(like), Job.company.ilike(like), Job.location.ilike(like)))
    if not include_closed:
        # Vaga que saiu do ar continua visível se você já estava no processo dela.
        stmt = stmt.where(or_(Job.is_active.is_(True), Job.status != Status.NEW))
    stmt = stmt.order_by(Job.first_seen.desc()).limit(1500)
    return list(session.scalars(stmt))


@app.patch("/api/jobs/{job_id}", response_model=JobOut, dependencies=[Depends(require_owner)])
def update_job(job_id: int, patch: JobPatch, session: SessionDep) -> Job:
    job = session.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Vaga não encontrada.")
    if patch.status is not None and patch.status != job.status:
        job.status = patch.status
        job.status_changed_at = datetime.now(timezone.utc)
    if patch.notes is not None:
        job.notes = patch.notes
    session.commit()
    session.refresh(job)
    return job


@app.get("/api/summary", response_model=Summary, dependencies=[Depends(require_reader)])
def summary(session: SessionDep) -> Summary:
    last = session.scalars(select(CollectionRun).order_by(CollectionRun.started_at.desc()).limit(1)).first()
    counts: dict[str, dict[str, int]] = {"br": {}, "intl": {}}
    rows = session.execute(
        select(Job.region, Job.status, func.count()).where(Job.is_active.is_(True)).group_by(Job.region, Job.status)
    )
    for region, status, n in rows:
        counts.setdefault(region, {})[status] = n
    companies = sorted(session.scalars(select(Job.company).distinct()))
    return Summary(last_run=RunOut.model_validate(last) if last else None, counts=counts, companies=companies)
