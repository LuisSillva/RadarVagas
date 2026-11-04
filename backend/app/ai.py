"""Camada de IA: decide os casos ambíguos e calcula a aderência ao seu perfil.

Roda só para vagas novas e com limite por coleta (AI_MAX_PER_RUN), então o
custo fica previsível. Sem ANTHROPIC_API_KEY, o radar funciona só com regras.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass

from .config import Settings

log = logging.getLogger(__name__)

PROMPT = """Você avalia vagas para um candidato. Perfil do candidato:
{profile}

Vaga:
Empresa: {company}
Título: {title}
Local: {location}
Descrição (trecho): {description}

Responda só com um JSON, sem texto fora dele:
{{"is_dev": true|false, "level": "intern"|"trainee"|"junior"|"other", "match": 0-100, "reason": "uma frase curta em português"}}

- is_dev: a vaga é de desenvolvimento de software, dados, IA, infraestrutura ou QA?
- level: intern inclui estágio, bolsa, aprendiz e internship. other = pleno, sênior ou não informado.
- match: o quanto a vaga combina com o perfil (stack, área, nível).
- reason: por que essa nota, citando algo concreto da vaga."""


@dataclass
class Verdict:
    is_dev: bool
    level: str
    match: int
    reason: str


def parse_verdict(text: str) -> Verdict | None:
    found = re.search(r"\{.*\}", text, re.S)
    if not found:
        return None
    try:
        data = json.loads(found.group(0))
        return Verdict(
            is_dev=bool(data["is_dev"]),
            level=str(data.get("level", "other")),
            match=max(0, min(100, int(data.get("match", 0)))),
            reason=str(data.get("reason", ""))[:300],
        )
    except (ValueError, KeyError, TypeError):
        return None


class Judge:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.remaining = settings.ai_max_per_run
        self._client = None
        if settings.anthropic_api_key:
            from anthropic import Anthropic

            self._client = Anthropic(api_key=settings.anthropic_api_key)

    @property
    def enabled(self) -> bool:
        return self._client is not None and self.remaining > 0

    def evaluate(self, *, company: str, title: str, location: str | None, description: str | None) -> Verdict | None:
        if not self.enabled:
            return None
        self.remaining -= 1
        prompt = PROMPT.format(
            profile=self.settings.candidate_profile,
            company=company,
            title=title,
            location=location or "não informado",
            description=(description or "sem descrição")[:2500],
        )
        try:
            msg = self._client.messages.create(
                model=self.settings.ai_model,
                max_tokens=300,
                messages=[{"role": "user", "content": prompt}],
            )
            text = "".join(block.text for block in msg.content if getattr(block, "type", "") == "text")
            return parse_verdict(text)
        except Exception as exc:  # a IA nunca derruba a coleta
            log.warning("IA falhou para %s / %s: %s", company, title, exc)
            return None
