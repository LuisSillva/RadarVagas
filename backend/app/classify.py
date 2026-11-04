"""Regras que decidem se uma vaga entra no radar.

Três perguntas para cada vaga:
1. Qual o nível? (estágio/bolsa, trainee/new grad, júnior, ou fora do escopo)
2. É vaga de desenvolvimento/tecnologia?
3. É no Brasil ou no exterior?

As regras resolvem a grande maioria. O que fica ambíguo vai para a camada de IA
(app/ai.py), se houver chave configurada.
"""

from __future__ import annotations

import re
import unicodedata

from .sources.base import RawJob


def normalize(text: str | None) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return text.lower()


def _rx(*patterns: str) -> re.Pattern[str]:
    return re.compile("|".join(patterns))


# ------------------------------------------------------------------ nível

INTERN_RX = _rx(
    r"\bestagi\w*",
    r"\bintern(ship)?s?\b",
    r"\bco-?op\b",
    r"\bbolsa\b",
    r"\bbolsista\w*",
    r"\baprendiz\w*",
    r"\bapprentice\w*",
    r"\bworking student\b",
    r"\bwerkstudent\w*",
    r"\bplacement\b",
    r"\bsummer analyst\b",
)
TRAINEE_RX = _rx(
    r"\btrainee\b",
    r"\bnew grad\w*",
    r"\bgraduate (program|programme|software|engineer|developer|analyst)\b",
    r"\b(software|engineering|technology|tech) graduate\b",
    r"\bearly career\b",
    r"\buniversity grad\w*",
    r"\brecent grad\w*",
    r"\bentry[- ]level\b",
    r"\bcampus\b",
)
JUNIOR_RX = _rx(
    r"\bjunior\b",
    r"\bjr\b\.?",
    r"\b(engineer|developer|desenvolvedor\w*|programmer|sde)\s+i\b",
    r"\bsde[- ]?1\b",
    r"\bl3\b",
    r"\bassociate (software|developer|engineer|data)\b",
)
SENIOR_RX = _rx(
    r"\bsenior\b",
    r"\bsr\b\.?",
    r"\bpleno\b",
    r"\bstaff\b",
    r"\bprincipal\b",
    r"\blead\b",
    r"\blider\b",
    r"\btech lead\b",
    r"\bmanager\b",
    r"\bgerente\b",
    r"\bdirector\b",
    r"\bdiretor\w*",
    r"\bhead\b",
    r"\bespecialista\b",
    r"\bcoordenador\w*",
    r"\barchitect\b",
    r"\barquitet\w*",
    r"\b(ii|iii|iv)\b",
    r"\bsde[- ]?(2|3)\b",
    r"\bmid[- ]level\b",
)


def classify_level(title: str, hint: str | None = None) -> str | None:
    """Retorna intern/trainee/junior ou None se a vaga não é de entrada."""
    t = normalize(title)
    if hint in {"intern", "trainee"}:
        return hint
    if INTERN_RX.search(t):
        return "intern"
    if SENIOR_RX.search(t):
        return None
    if TRAINEE_RX.search(t):
        return "trainee"
    if JUNIOR_RX.search(t) or hint == "junior":
        return "junior"
    return None


# ------------------------------------------------------------- área de dev

STRONG_DEV_RX = _rx(
    r"\bsoftware\b",
    r"\bdesenvolv\w*",
    r"\bdeveloper\w*",
    r"\bdevelopment engineer\b",
    r"\bprogramad\w*",
    r"\bprogramming\b",
    r"\bback-?end\b",
    r"\bfront-?end\b",
    r"\bfull-?\s?stack\b",
    r"\bmobile\b",
    r"\b(android|ios)\b",
    r"\bdevops\b",
    r"\bsre\b",
    r"\bsite reliability\b",
    r"\bmachine learning\b",
    r"\b(ml|ai) engineer\w*",
    r"\bengenh\w* de (software|dados|computacao|machine learning|ia)\b",
    r"\bdata engineer\w*",
    r"\bsde\b",
    r"\bswe\b",
)
WEAK_DEV_RX = _rx(
    r"\btecnologia\b",
    r"\bti\b",
    r"\bit\b",
    r"\bdados\b",
    r"\bdata\b",
    r"\bengineer\w*",
    r"\bengenh\w*",
    r"\bcloud\b",
    r"\binfra\w*",
    r"\bplataforma\b",
    r"\bplatform\b",
    r"\bseguranca da informacao\b",
    r"\b(cyber)?security\b",
    r"\bqa\b",
    r"\bquality assurance\b",
    r"\btest\w* automation\b",
    r"\bsistemas\b",
    r"\b(ia|ai)\b",
    r"\binteligencia artificial\b",
    r"\bcomputa\w*",
    r"\bcomputer science\b",
    r"\btech\b",
    r"\bdigital\b",
    r"\banalytics\b",
)
NON_DEV_RX = _rx(
    r"\bmarketing\b",
    r"\bvendas\b",
    r"\bsales\b",
    r"\bcomercial\b",
    r"\bjuridic\w*",
    r"\blegal\b",
    r"\bfinanc\w*",
    r"\bcontab\w*",
    r"\baccount\w*",
    r"\brecursos humanos\b",
    r"\b(rh|hr)\b",
    r"\bpeople\b",
    r"\brecruit\w*",
    r"\btalent\b",
    r"\batendimento\b",
    r"\bcustomer\b",
    r"\blogistic\w*",
    r"\bsupply\b",
    r"\bcompras\b",
    r"\bprocurement\b",
    r"\badministrativ\w*",
    r"\bcomunicacao\b",
    r"\bdesign grafico\b",
    r"\bmerchandis\w*",
)


# Outras engenharias: "engineering" aparece no título, mas não é software.
OTHER_ENGINEERING_RX = _rx(
    r"\bcivil\b",
    r"\bmecanic\w*",
    r"\bmechanical\b",
    r"\beletric\w*",
    r"\belectrical\b",
    r"\bquimic\w*",
    r"\bchemical\b",
    r"\bproducao\b",
    r"\bmanufactur\w*",
    r"\bhardware\b",
)


def classify_dev(title: str) -> bool | None:
    """True = é dev, False = não é, None = ambíguo (manda para a IA)."""
    t = normalize(title)
    if STRONG_DEV_RX.search(t):
        return True
    if OTHER_ENGINEERING_RX.search(t):
        return False
    weak = bool(WEAK_DEV_RX.search(t))
    non_dev = bool(NON_DEV_RX.search(t))
    if weak and not non_dev:
        return True
    if weak and non_dev:
        return None
    if INTERN_RX.search(t) and not non_dev and len(t.split()) <= 3:
        # "Estágio 2027", "Programa de Estágio": genérico, a IA decide.
        return None
    return False


# ------------------------------------------------------------------ região

BR_RX = _rx(
    r"\bbrasil\b",
    r"\bbrazil\b",
    r"\bsao paulo\b",
    r"\brio de janeiro\b",
    r"\bbelo horizonte\b",
    r"\bcuritiba\b",
    r"\bporto alegre\b",
    r"\bflorianopolis\b",
    r"\brecife\b",
    r"\bcampinas\b",
    r"\bbrasilia\b",
    r"\bsalvador\b",
    r"\bfortaleza\b",
    r"\bpasso fundo\b",
    r"\bjoinville\b",
    r"\bbarueri\b",
    r"\bosasco\b",
    r"\bsao carlos\b",
    r"\bsao jose dos campos\b",
    r",\s*(sp|rj|mg|pr|rs|sc|pe|ba|df|ce|go)\b",
)


def classify_region(job: RawJob) -> str:
    country = normalize(job.country)
    if country in {"br", "bra", "brasil", "brazil"}:
        return "br"
    if country and country not in {"", "remote"}:
        return "intl"
    if job.source == "gupy":
        return "br"
    return "br" if BR_RX.search(normalize(job.location)) else "intl"
