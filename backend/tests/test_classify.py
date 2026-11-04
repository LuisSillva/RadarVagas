import pytest

from app.classify import classify_dev, classify_level, classify_region
from app.sources.base import RawJob


@pytest.mark.parametrize(
    "title,expected",
    [
        ("Estágio em Desenvolvimento de Software", "intern"),
        ("Estagiário(a) de Tecnologia", "intern"),
        ("Software Engineering Intern - Summer 2027", "intern"),
        ("Bolsa de Iniciação em Dados", "intern"),
        ("Jovem Aprendiz - TI", "intern"),
        ("Programa Trainee Tecnologia 2027", "trainee"),
        ("Software Engineer, New Grad", "trainee"),
        ("Pessoa Desenvolvedora Back-end Júnior", "junior"),
        ("Desenvolvedor Jr. Python", "junior"),
        ("Software Engineer I", "junior"),
        ("Software Engineer II", None),
        ("Senior Software Engineer", None),
        ("Desenvolvedor Pleno Java", None),
        ("Staff Engineer, Platform", None),
        ("Software Engineer", None),
        ("Engineering Manager", None),
    ],
)
def test_level(title, expected):
    assert classify_level(title) == expected


def test_level_hint_from_ats_wins():
    assert classify_level("Programa 2027", hint="intern") == "intern"
    assert classify_level("Analista", hint="junior") == "junior"


@pytest.mark.parametrize(
    "title,expected",
    [
        ("Estágio em Desenvolvimento de Software", True),
        ("Software Engineering Intern", True),
        ("Estágio em Dados", True),
        ("Estágio em Tecnologia", True),
        ("Machine Learning Intern", True),
        ("Estágio em Marketing", False),
        ("Sales Development Intern", False),
        ("Estágio Jurídico", False),
        ("Mechanical Engineering Intern", False),
        ("Finance Data Intern", None),
        ("Estágio 2027", None),
    ],
)
def test_dev(title, expected):
    assert classify_dev(title) is expected


@pytest.mark.parametrize(
    "location,country,source,expected",
    [
        ("São Paulo, SP", None, "greenhouse", "br"),
        ("Sao Paulo, Brazil", None, "lever", "br"),
        ("Remote - Brazil", None, "ashby", "br"),
        ("Mexico City", None, "greenhouse", "intl"),
        ("Remote - LATAM", None, "greenhouse", "intl"),
        ("Dublin, Ireland", "IE", "smartrecruiters", "intl"),
        ("Curitiba", "BR", "smartrecruiters", "br"),
        ("Remoto", "Brasil", "gupy", "br"),
        (None, None, "gupy", "br"),
    ],
)
def test_region(location, country, source, expected):
    job = RawJob(source=source, external_id="1", company="X", title="t", url="u", location=location, country=country)
    assert classify_region(job) == expected


@pytest.mark.parametrize(
    "title,location,flag,expected",
    [
        ("Software Engineer Intern", "Remote - Brazil", False, True),
        ("Estágio em Dados", "Remoto", False, True),
        ("Estágio em TI (Home Office)", "Porto Alegre, RS", False, True),
        ("Desenvolvedor Júnior", "São Paulo, SP", True, True),  # ATS marcou como remoto
        ("Desenvolvedor Júnior - Híbrido", "São Paulo, SP", True, False),
        ("Software Engineer Intern", "Hybrid - Dublin", False, False),
        ("Software Engineer Intern", "London, UK", False, False),
        ("Backend Intern", "Anywhere", False, True),
    ],
)
def test_remote(title, location, flag, expected):
    from app.classify import classify_remote

    job = RawJob(source="x", external_id="1", company="X", title=title, url="u", location=location, remote=flag)
    assert classify_remote(job) is expected
