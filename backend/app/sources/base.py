"""Contrato comum dos adaptadores de ATS.

Cada adaptador sabe falar com um sistema de recrutamento (Gupy, Greenhouse...)
e devolve uma lista de RawJob já normalizada. A parte de "é vaga de dev
júnior?" fica fora daqui, em app/classify.py.
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

USER_AGENT = "RadarDeVagas/1.0 (projeto pessoal; github.com)"


@dataclass
class RawJob:
    source: str
    external_id: str
    company: str
    title: str
    url: str
    location: str | None = None
    country: str | None = None
    remote: bool = False
    posted_at: datetime | None = None
    description: str | None = None
    # Data limite de inscrição, quando o ATS informa (a Gupy informa).
    deadline: datetime | None = None
    # Dica de nível vinda do próprio ATS (ex.: Gupy marca "estágio" no tipo da vaga).
    level_hint: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class CompanySource:
    """Uma empresa + como achar as vagas dela em um ATS."""

    company: str
    category: str
    ats: str
    id: str | None = None  # slug do board (greenhouse, lever, ashby...)
    match: list[str] = field(default_factory=list)  # nomes na Gupy
    options: dict[str, Any] = field(default_factory=dict)


class SourceError(Exception):
    pass


def make_client(timeout: float = 20.0) -> httpx.Client:
    return httpx.Client(
        timeout=timeout,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        follow_redirects=True,
    )


def get_json(client: httpx.Client, url: str, **kwargs: Any) -> Any:
    try:
        resp = client.get(url, **kwargs)
        resp.raise_for_status()
        return resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise SourceError(f"GET {url}: {exc}") from exc


def post_json(client: httpx.Client, url: str, payload: dict, **kwargs: Any) -> Any:
    try:
        resp = client.post(url, json=payload, **kwargs)
        resp.raise_for_status()
        return resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise SourceError(f"POST {url}: {exc}") from exc


_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def strip_html(value: str | None, limit: int = 4000) -> str | None:
    if not value:
        return None
    text = html.unescape(_TAG_RE.sub(" ", html.unescape(value)))
    text = _WS_RE.sub(" ", text).strip()
    return text[:limit] or None


BRT = timezone(timedelta(hours=-3))


def parse_deadline(value: Any) -> datetime | None:
    """Prazo só com data ("2026-11-30") vale até o fim do dia no horário de Brasília."""
    if value in (None, ""):
        return None
    text = str(value).strip()
    if len(text) == 10:
        try:
            end_of_day = datetime.fromisoformat(text).replace(hour=23, minute=59, second=59, tzinfo=BRT)
            return end_of_day.astimezone(timezone.utc)
        except ValueError:
            return None
    return parse_dt(text)


def parse_dt(value: Any) -> datetime | None:
    """Aceita ISO 8601 (com ou sem Z) e timestamps em milissegundos."""
    if value in (None, ""):
        return None
    try:
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(value / 1000, tz=timezone.utc)
        text = str(value).strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(text)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (ValueError, OSError):
        return None
