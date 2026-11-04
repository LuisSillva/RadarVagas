"""Adaptadores de boards públicos: Greenhouse, Lever, Ashby, SmartRecruiters,
Workday e Amazon. Cada um tem uma função `parse_*` pura (testada com
fixtures) e uma `fetch_*` que faz as requisições.
"""

from __future__ import annotations

import httpx

from .base import CompanySource, RawJob, get_json, parse_dt, post_json, strip_html

# ---------------------------------------------------------------- Greenhouse


def parse_greenhouse(data: dict, company: str) -> list[RawJob]:
    jobs = []
    for item in data.get("jobs", []):
        loc = (item.get("location") or {}).get("name")
        jobs.append(
            RawJob(
                source="greenhouse",
                external_id=str(item["id"]),
                company=company,
                title=item.get("title", "").strip(),
                url=item.get("absolute_url", ""),
                location=loc,
                remote="remote" in (loc or "").lower(),
                posted_at=parse_dt(item.get("first_published") or item.get("updated_at")),
                description=strip_html(item.get("content")),
            )
        )
    return jobs


def fetch_greenhouse(client: httpx.Client, src: CompanySource) -> list[RawJob]:
    data = get_json(client, f"https://boards-api.greenhouse.io/v1/boards/{src.id}/jobs", params={"content": "true"})
    return parse_greenhouse(data, src.company)


# --------------------------------------------------------------------- Lever


def parse_lever(data: list, company: str) -> list[RawJob]:
    jobs = []
    for item in data:
        cats = item.get("categories") or {}
        loc = cats.get("location") or ", ".join(cats.get("allLocations") or []) or None
        commitment = (cats.get("commitment") or "").lower()
        jobs.append(
            RawJob(
                source="lever",
                external_id=str(item["id"]),
                company=company,
                title=item.get("text", "").strip(),
                url=item.get("hostedUrl", ""),
                location=loc,
                country=item.get("country"),
                remote=(item.get("workplaceType") == "remote") or "remote" in (loc or "").lower(),
                posted_at=parse_dt(item.get("createdAt")),
                description=strip_html(item.get("descriptionPlain") or item.get("description")),
                level_hint="intern" if "intern" in commitment else None,
            )
        )
    return jobs


def fetch_lever(client: httpx.Client, src: CompanySource) -> list[RawJob]:
    region = src.options.get("region")  # Lever EU usa api.eu.lever.co
    host = "api.eu.lever.co" if region == "eu" else "api.lever.co"
    data = get_json(client, f"https://{host}/v0/postings/{src.id}", params={"mode": "json"})
    return parse_lever(data, src.company)


# --------------------------------------------------------------------- Ashby


def parse_ashby(data: dict, company: str) -> list[RawJob]:
    jobs = []
    for item in data.get("jobs", []):
        if item.get("isListed") is False:
            continue
        address = ((item.get("address") or {}).get("postalAddress")) or {}
        employment = (item.get("employmentType") or "").lower()
        jobs.append(
            RawJob(
                source="ashby",
                external_id=str(item.get("id") or item.get("jobUrl")),
                company=company,
                title=item.get("title", "").strip(),
                url=item.get("jobUrl") or item.get("applyUrl") or "",
                location=item.get("location"),
                country=address.get("addressCountry"),
                remote=bool(item.get("isRemote")) or (item.get("workplaceType") or "").lower() == "remote",
                posted_at=parse_dt(item.get("publishedAt")),
                description=strip_html(item.get("descriptionPlain") or item.get("descriptionHtml")),
                level_hint="intern" if employment == "intern" else None,
            )
        )
    return jobs


def fetch_ashby(client: httpx.Client, src: CompanySource) -> list[RawJob]:
    data = get_json(client, f"https://api.ashbyhq.com/posting-api/job-board/{src.id}")
    return parse_ashby(data, src.company)


# ----------------------------------------------------------- SmartRecruiters

SR_LEVELS = {"internship": "intern", "entry_level": "junior"}


def parse_smartrecruiters(data: dict, company: str) -> list[RawJob]:
    jobs = []
    for item in data.get("content", []):
        loc = item.get("location") or {}
        loc_text = loc.get("fullLocation") or ", ".join(
            p for p in (loc.get("city"), loc.get("region"), loc.get("country")) if p
        )
        level = SR_LEVELS.get(((item.get("experienceLevel") or {}).get("id") or "").lower())
        jobs.append(
            RawJob(
                source="smartrecruiters",
                external_id=str(item["id"]),
                company=company,
                title=item.get("name", "").strip(),
                url=f"https://jobs.smartrecruiters.com/{(item.get('company') or {}).get('identifier', '')}/{item['id']}",
                location=loc_text or None,
                country=(loc.get("country") or "").upper() or None,
                remote=bool(loc.get("remote")),
                posted_at=parse_dt(item.get("releasedDate")),
                level_hint=level,
            )
        )
    return jobs


def fetch_smartrecruiters(client: httpx.Client, src: CompanySource) -> list[RawJob]:
    jobs: list[RawJob] = []
    for offset in range(0, 1000, 100):
        data = get_json(
            client,
            f"https://api.smartrecruiters.com/v1/companies/{src.id}/postings",
            params={"limit": 100, "offset": offset},
        )
        jobs.extend(parse_smartrecruiters(data, src.company))
        if offset + 100 >= int(data.get("totalFound") or 0):
            break
    return jobs


# ------------------------------------------------------------------- Workday
# Muitos bancos e multinacionais usam Workday. O site de carreiras tem um
# endpoint JSON interno (cxs). `id` = tenant, options: host (wd1, wd5...) e site.

WORKDAY_SEARCHES = ["intern", "internship", "estágio", "junior", "new grad", "graduate", "early career"]


def parse_workday(data: dict, company: str, base_url: str) -> list[RawJob]:
    jobs = []
    for item in data.get("jobPostings", []):
        path = item.get("externalPath") or ""
        if not path:
            continue
        bullets = item.get("bulletFields") or []
        jobs.append(
            RawJob(
                source="workday",
                external_id=f"{company}:{path.rsplit('_', 1)[-1] if '_' in path else path}",
                company=company,
                title=item.get("title", "").strip(),
                url=f"{base_url}{path}",
                location=item.get("locationsText"),
                remote=(item.get("remoteType") or "").lower() == "remote"
                or "remote" in (item.get("locationsText") or "").lower(),
                # Workday só dá texto tipo "Posted 3 Days Ago"; guardamos para exibir.
                extra={"postedOn": item.get("postedOn"), "reqId": bullets[0] if bullets else None},
            )
        )
    return jobs


def fetch_workday(client: httpx.Client, src: CompanySource) -> list[RawJob]:
    tenant, host, site = src.id, src.options["host"], src.options["site"]
    api = f"https://{tenant}.{host}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs"
    base_url = f"https://{tenant}.{host}.myworkdayjobs.com/{site}"
    seen: dict[str, RawJob] = {}
    for term in src.options.get("searches", WORKDAY_SEARCHES):
        for offset in range(0, 200, 20):
            data = post_json(client, api, {"appliedFacets": {}, "limit": 20, "offset": offset, "searchText": term})
            batch = parse_workday(data, src.company, base_url)
            for job in batch:
                seen[job.external_id] = job
            if len(batch) < 20:
                break
    return list(seen.values())


# -------------------------------------------------------------------- Amazon


def parse_amazon(data: dict, company: str) -> list[RawJob]:
    jobs = []
    for item in data.get("jobs", []):
        jobs.append(
            RawJob(
                source="amazon",
                external_id=str(item.get("id_icims") or item.get("id")),
                company=company,
                title=item.get("title", "").strip(),
                url="https://www.amazon.jobs" + (item.get("job_path") or ""),
                location=item.get("normalized_location") or item.get("location"),
                country=item.get("country_code"),
                posted_at=parse_dt(item.get("posted_date")) if "T" in str(item.get("posted_date", "")) else None,
                description=strip_html(item.get("description_short") or item.get("description")),
                extra={"postedText": item.get("posted_date")},
            )
        )
    return jobs


def fetch_amazon(client: httpx.Client, src: CompanySource) -> list[RawJob]:
    seen: dict[str, RawJob] = {}
    for term in ["software development engineer intern", "software engineer intern", "new grad software", "estágio"]:
        data = get_json(
            client,
            "https://www.amazon.jobs/en/search.json",
            params={"base_query": term, "result_limit": 100, "offset": 0, "sort": "recent"},
        )
        for job in parse_amazon(data, src.company):
            seen[job.external_id] = job
    return list(seen.values())


# ------------------------------------------------------------------ Eightfold
# Usado por Microsoft, Netflix, Qualcomm e outras. O site de carreiras chama uma
# API JSON pública. Existem duas versões: a nova (pcsx) e a antiga (apply/v2);
# tentamos a nova e caímos na antiga. `id` = domínio da empresa, options.host = site.

EIGHTFOLD_SEARCHES = ["intern", "internship", "new grad", "junior", "estágio"]


def _eightfold_remote(item: dict) -> bool:
    option = str(item.get("workLocationOption") or item.get("work_location_option") or "").lower()
    return option == "remote" or bool(item.get("isRemote"))


def parse_eightfold(data: dict, company: str, host: str) -> list[RawJob]:
    payload = data.get("data") if isinstance(data.get("data"), dict) else data
    jobs = []
    for item in payload.get("positions", []):
        locations = item.get("locations") or ([item["location"]] if item.get("location") else [])
        url = item.get("canonicalPositionUrl") or item.get("positionUrl") or f"/careers/job/{item.get('id')}"
        if url.startswith("/"):
            url = f"https://{host}{url}"
        posted = item.get("postedTs") or item.get("t_create") or item.get("t_update")
        jobs.append(
            RawJob(
                source="eightfold",
                external_id=f"{company}:{item.get('atsJobId') or item.get('ats_job_id') or item.get('id')}",
                company=company,
                title=(item.get("name") or item.get("title") or "").strip(),
                url=url,
                location="; ".join(locations[:3]) or None,
                remote=_eightfold_remote(item),
                posted_at=parse_dt(posted * 1000) if isinstance(posted, (int, float)) else parse_dt(posted),
                description=strip_html(item.get("job_description") or item.get("description")),
            )
        )
    return jobs


def fetch_eightfold(client: httpx.Client, src: CompanySource) -> list[RawJob]:
    host, domain = src.options["host"], src.id
    seen: dict[str, RawJob] = {}
    endpoints = [f"https://{host}/api/pcsx/search", f"https://{host}/api/apply/v2/jobs"]
    last_error: SourceError | None = None
    for endpoint in endpoints:
        try:
            for term in src.options.get("searches", EIGHTFOLD_SEARCHES):
                for start in range(0, 100, 10):
                    data = get_json(client, endpoint, params={"domain": domain, "query": term, "start": start, "num": 10})
                    batch = parse_eightfold(data, src.company, host)
                    for job in batch:
                        seen[job.external_id] = job
                    if len(batch) < 10:
                        break
            return list(seen.values())
        except SourceError as exc:
            last_error = exc
            seen.clear()
    raise last_error or SourceError(f"eightfold {host}: sem resposta")


FETCHERS = {
    "greenhouse": fetch_greenhouse,
    "lever": fetch_lever,
    "ashby": fetch_ashby,
    "smartrecruiters": fetch_smartrecruiters,
    "workday": fetch_workday,
    "amazon": fetch_amazon,
    "eightfold": fetch_eightfold,
}
