"""Testa a leitura das respostas de cada ATS com payloads no formato real das APIs."""

from app.sources import gupy
from app.sources.base import CompanySource
from app.sources.boards import (
    parse_ashby,
    parse_greenhouse,
    parse_lever,
    parse_smartrecruiters,
    parse_workday,
)

GUPY_ITEM = {
    "id": 9876543,
    "companyId": 119,
    "name": "Estágio em Engenharia de Software",
    "description": "<p>Venha construir o futuro &amp; aprender</p>",
    "careerPageName": "Itaú Unibanco",
    "careerPageUrl": "https://vemproitau.gupy.io",
    "type": "vacancy_type_internship",
    "publishedDate": "2026-10-28T13:00:00.000Z",
    "applicationDeadline": "2026-11-30",
    "isRemoteWork": False,
    "city": "São Paulo",
    "state": "São Paulo",
    "country": "Brasil",
    "jobUrl": "https://vemproitau.gupy.io/jobs/9876543",
    "workplaceType": "hybrid",
}


def test_gupy_parse_and_match():
    sources = [
        CompanySource(company="Itaú Unibanco", category="bank", ats="gupy", match=["itau"]),
        CompanySource(company="WEG", category="multinational", ats="gupy", match=["weg"]),
    ]
    src = gupy.match_company(GUPY_ITEM, sources)
    assert src is not None and src.company == "Itaú Unibanco"
    job = gupy.parse_job(GUPY_ITEM, src.company)
    assert job.level_hint == "intern"
    assert job.location == "São Paulo, São Paulo"
    assert job.description == "Venha construir o futuro & aprender"
    assert job.posted_at.year == 2026


def test_gupy_match_uses_whole_words():
    sources = [CompanySource(company="WEG", category="multinational", ats="gupy", match=["weg"])]
    assert gupy.match_company({"careerPageName": "Norwegian Air"}, sources) is None
    assert gupy.match_company({"careerPageName": "WEG S.A.", "careerPageUrl": "https://weg.gupy.io"}, sources)


def test_greenhouse():
    data = {
        "jobs": [
            {
                "id": 7012345,
                "title": "Software Engineer Intern",
                "absolute_url": "https://boards.greenhouse.io/nubank/jobs/7012345",
                "location": {"name": "São Paulo, Brazil"},
                "first_published": "2026-10-20T10:00:00-04:00",
                "content": "&lt;p&gt;Build things&lt;/p&gt;",
            }
        ],
        "meta": {"total": 1},
    }
    [job] = parse_greenhouse(data, "Nubank")
    assert job.external_id == "7012345"
    assert job.location == "São Paulo, Brazil"
    assert job.description == "Build things"


def test_lever():
    data = [
        {
            "id": "abc-123",
            "text": "Software Engineer, Intern",
            "hostedUrl": "https://jobs.lever.co/palantir/abc-123",
            "categories": {"location": "London, UK", "commitment": "Internship"},
            "createdAt": 1761000000000,
            "country": "GB",
            "workplaceType": "onsite",
            "descriptionPlain": "Desc",
        }
    ]
    [job] = parse_lever(data, "Palantir")
    assert job.level_hint == "intern" and job.country == "GB" and job.posted_at is not None


def test_ashby():
    data = {
        "jobs": [
            {
                "id": "u-1",
                "title": "Research Engineer Intern",
                "location": "San Francisco",
                "employmentType": "Intern",
                "isRemote": False,
                "isListed": True,
                "publishedAt": "2026-10-01T00:00:00.000+00:00",
                "jobUrl": "https://jobs.ashbyhq.com/openai/u-1",
                "address": {"postalAddress": {"addressCountry": "United States"}},
            },
            {"id": "u-2", "title": "Hidden", "isListed": False},
        ]
    }
    jobs = parse_ashby(data, "OpenAI")
    assert len(jobs) == 1 and jobs[0].level_hint == "intern" and jobs[0].country == "United States"


def test_smartrecruiters():
    data = {
        "totalFound": 1,
        "content": [
            {
                "id": "744000",
                "name": "Software Engineer Intern",
                "releasedDate": "2026-10-10T08:00:00.000Z",
                "location": {"city": "Campinas", "country": "br", "remote": False},
                "experienceLevel": {"id": "internship"},
                "company": {"identifier": "BoschGroup"},
            }
        ],
    }
    [job] = parse_smartrecruiters(data, "Bosch")
    assert job.country == "BR" and job.level_hint == "intern"
    assert job.url.endswith("/BoschGroup/744000")


def test_workday():
    data = {
        "total": 1,
        "jobPostings": [
            {
                "title": "Software Engineering Intern - Fall 2027",
                "externalPath": "/job/US-CA-Santa-Clara/Software-Engineering-Intern_JR2001234",
                "locationsText": "US, CA, Santa Clara",
                "postedOn": "Posted 2 Days Ago",
                "bulletFields": ["JR2001234"],
            }
        ],
    }
    [job] = parse_workday(data, "NVIDIA", "https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite")
    assert job.external_id == "NVIDIA:JR2001234"
    assert job.url.startswith("https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite/job/")


def test_gupy_deadline_is_end_of_day_in_brasilia():
    job = gupy.parse_job(GUPY_ITEM, "Itaú Unibanco")
    # 30/11 23:59:59 em Brasília = 01/12 02:59:59 UTC
    assert job.deadline.isoformat() == "2026-12-01T02:59:59+00:00"
    assert gupy.parse_job({**GUPY_ITEM, "applicationDeadline": None}, "X").deadline is None


def test_eightfold_v2_and_pcsx_shapes():
    from app.sources.boards import parse_eightfold

    v2 = {
        "count": 1,
        "positions": [
            {
                "id": 1970393556625300,
                "ats_job_id": "200012345",
                "name": "Software Engineer: Internship Opportunities",
                "locations": ["Redmond, Washington, United States"],
                "t_create": 1761000000,
                "canonicalPositionUrl": "https://apply.careers.microsoft.com/careers/job/1970393556625300",
                "work_location_option": "onsite",
            }
        ],
    }
    [job] = parse_eightfold(v2, "Microsoft", "apply.careers.microsoft.com")
    assert job.external_id == "Microsoft:200012345" and not job.remote
    assert job.posted_at.year == 2025

    pcsx = {
        "data": {
            "count": 1,
            "positions": [
                {
                    "id": 790300000001,
                    "name": "Software Engineering Intern",
                    "locations": ["Remote, Brazil"],
                    "postedTs": 1761000000,
                    "positionUrl": "/careers/job/790300000001",
                    "workLocationOption": "remote",
                }
            ],
        }
    }
    [job] = parse_eightfold(pcsx, "Netflix", "explore.jobs.netflix.net")
    assert job.remote and job.url == "https://explore.jobs.netflix.net/careers/job/790300000001"
