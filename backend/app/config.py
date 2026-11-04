from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./radar.db"
    admin_token: str = "troque-este-token"
    # Quando true, qualquer pessoa pode ler as vagas (útil para demo pública).
    public_read: bool = False
    allowed_origins: str = "http://localhost:3000"

    # Camada de IA (opcional). Sem chave, o coletor usa só as regras.
    anthropic_api_key: str | None = None
    ai_model: str = "claude-haiku-5-5"
    ai_max_per_run: int = 60
    # Resumo do seu perfil usado para calcular a aderência de cada vaga.
    candidate_profile: str = (
        "Estudante de Ciência da Computação (2026-2029), Python, FastAPI, Django, "
        "HTML/CSS, automações com IA e agentes de WhatsApp, 2 jogos publicados no Roblox. "
        "Busca estágio ou vaga júnior de desenvolvimento, de preferência back-end, dados ou IA."
    )

    http_timeout: float = 20.0

    @property
    def sqlalchemy_url(self) -> str:
        url = self.database_url
        if url.startswith("postgres://"):
            url = "postgresql+psycopg://" + url[len("postgres://") :]
        elif url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://") :]
        return url

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
