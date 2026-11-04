from datetime import datetime, timezone
from enum import StrEnum

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Status(StrEnum):
    NEW = "new"  # apareceu na coleta, ainda não olhei
    SAVED = "saved"  # me interessei
    APPLIED = "applied"  # candidatura enviada
    PROCESS = "process"  # teste, case ou entrevista
    OFFER = "offer"
    CLOSED = "closed"  # recusado, desisti ou vaga encerrada


class Level(StrEnum):
    INTERN = "intern"  # estágio, bolsa, aprendiz, internship
    TRAINEE = "trainee"  # trainee, new grad, early career
    JUNIOR = "junior"


class Region(StrEnum):
    BR = "br"
    INTL = "intl"


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (UniqueConstraint("source", "external_id", name="uq_source_external"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(32), index=True)
    external_id: Mapped[str] = mapped_column(String(128))

    company: Mapped[str] = mapped_column(String(128), index=True)
    company_category: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(300))
    url: Mapped[str] = mapped_column(String(1000))
    location: Mapped[str | None] = mapped_column(String(300))
    country: Mapped[str | None] = mapped_column(String(64))
    region: Mapped[str] = mapped_column(String(8), index=True)
    remote: Mapped[bool] = mapped_column(Boolean, default=False)
    level: Mapped[str] = mapped_column(String(16), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    status: Mapped[str] = mapped_column(String(16), default=Status.NEW, index=True)
    status_changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    notes: Mapped[str] = mapped_column(Text, default="")

    ai_match: Mapped[int | None] = mapped_column(Integer)
    ai_reason: Mapped[str | None] = mapped_column(Text)


class Rejected(Base):
    """Vagas ambíguas que a IA já descartou, para não perguntar de novo a cada coleta."""

    __tablename__ = "rejected"
    __table_args__ = (UniqueConstraint("source", "external_id", name="uq_rejected"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(32))
    external_id: Mapped[str] = mapped_column(String(128))


class CollectionRun(Base):
    __tablename__ = "collection_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    stats: Mapped[dict] = mapped_column(JSON, default=dict)
    errors: Mapped[list] = mapped_column(JSON, default=list)
