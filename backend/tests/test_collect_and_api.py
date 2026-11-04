from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.collect import upsert
from app.main import app
from app.models import Job
from app.sources.base import RawJob

CATS = {"Nubank": "fintech"}
AUTH = {"Authorization": "Bearer segredo-de-teste"}


def raw(ext_id, title, location="São Paulo, Brazil"):
    return RawJob(source="greenhouse", external_id=ext_id, company="Nubank", title=title, url=f"https://x/{ext_id}", location=location)


def test_upsert_filters_tracks_and_closes(session):
    t0 = datetime(2026, 11, 1, tzinfo=timezone.utc)
    stats = upsert(
        session,
        {("greenhouse", "Nubank"): [
            raw("1", "Software Engineer Intern"),
            raw("2", "Senior Software Engineer"),
            raw("3", "Estágio em Marketing"),
            raw("4", "Data Engineer Intern", location="Mexico City"),
        ]},
        CATS,
        now=t0,
    )
    session.commit()
    jobs = {j.external_id: j for j in session.scalars(select(Job))}
    assert set(jobs) == {"1", "4"}
    assert stats["new"] == 2
    assert jobs["1"].region == "br" and jobs["4"].region == "intl"

    jobs["1"].status = "applied"
    session.commit()

    # Segunda coleta: a vaga 1 sumiu do board, a 4 continua.
    stats = upsert(session, {("greenhouse", "Nubank"): [raw("4", "Data Engineer Intern", "Mexico City")]}, CATS, now=t0 + timedelta(hours=6))
    session.commit()
    j1 = session.scalar(select(Job).where(Job.external_id == "1"))
    assert stats["closed"] == 1 and j1.is_active is False and j1.status == "applied"

    # Volta a aparecer: reabre sem perder o status.
    stats = upsert(session, {("greenhouse", "Nubank"): [raw("1", "Software Engineer Intern"), raw("4", "Data Engineer Intern", "Mexico City")]}, CATS)
    session.commit()
    session.refresh(j1)
    assert stats["reopened"] == 1 and j1.is_active and j1.status == "applied"


def test_api_requires_token_and_updates(session):
    upsert(session, {("greenhouse", "Nubank"): [raw("10", "Desenvolvedor Júnior Python")]}, CATS)
    session.commit()

    with TestClient(app) as client:
        assert client.get("/api/jobs").status_code == 401
        res = client.get("/api/jobs", params={"region": "br"}, headers=AUTH)
        assert res.status_code == 200
        [job] = res.json()
        assert job["level"] == "junior" and job["status"] == "new"

        res = client.patch(f"/api/jobs/{job['id']}", json={"status": "saved", "notes": "Pedir indicação"}, headers=AUTH)
        assert res.status_code == 200 and res.json()["status"] == "saved"

        assert client.patch(f"/api/jobs/{job['id']}", json={"status": "inventado"}, headers=AUTH).status_code == 422
        assert client.get("/api/summary", headers=AUTH).json()["counts"]["br"] == {"saved": 1}
