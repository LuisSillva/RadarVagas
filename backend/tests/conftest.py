import os
import tempfile

# Banco temporário e token fixo antes de importar o app.
_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["ADMIN_TOKEN"] = "segredo-de-teste"
os.environ.pop("ANTHROPIC_API_KEY", None)

import pytest  # noqa: E402

from app.db import Base, SessionLocal, engine, init_db  # noqa: E402


@pytest.fixture()
def session():
    init_db()
    with SessionLocal() as s:
        yield s
    Base.metadata.drop_all(engine)
