"""
#10Dobro_Brain
#Ctx_Transparencia10 #Ctx_DB #Ctx_Setup

Configuração e inicialização do banco de dados — Transparencia10.

Uso:
    from infrastructure.db.setup import init_db, get_session, engine

    # Na inicialização da aplicação:
    await init_db()

    # Em endpoints FastAPI (injeção de dependência):
    async def meu_endpoint(session: AsyncSession = Depends(get_session)):
        ...
"""
from __future__ import annotations

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from .models import Base

# ─────────────────────────────────────────────────────────────────────────────
# URL do banco de dados
# ─────────────────────────────────────────────────────────────────────────────

# Lê do ambiente; default SQLite assíncrono para desenvolvimento local
# Em produção, configure: DATABASE_URL=postgresql+asyncpg://user:pass@host/db
_DATABASE_URL_RAW = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./transparencia10.db")

# Normaliza prefixo caso venha da Heroku/Railway sem driver assíncrono
if _DATABASE_URL_RAW.startswith("postgres://"):
    _DATABASE_URL_RAW = _DATABASE_URL_RAW.replace("postgres://", "postgresql+asyncpg://", 1)
elif _DATABASE_URL_RAW.startswith("postgresql://") and "+asyncpg" not in _DATABASE_URL_RAW:
    _DATABASE_URL_RAW = _DATABASE_URL_RAW.replace("postgresql://", "postgresql+asyncpg://", 1)

DATABASE_URL: str = _DATABASE_URL_RAW

# ─────────────────────────────────────────────────────────────────────────────
# Engine e fábrica de sessões
# ─────────────────────────────────────────────────────────────────────────────

# connect_args apenas necessário para SQLite (evita erros de thread)
_connect_args: dict = {}
if DATABASE_URL.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}

engine: AsyncEngine = create_async_engine(
    DATABASE_URL,
    echo=os.getenv("DB_ECHO", "false").lower() == "true",  # logs SQL via env
    connect_args=_connect_args,
    # Pool de conexões — SQLite não suporta pool, usa StaticPool implícito
    pool_pre_ping=True,  # valida conexão antes de usar do pool
)

# Fábrica de sessões assíncronas reutilizável
AsyncSessionFactory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,  # evita lazy-load após commit
    autoflush=False,
    autocommit=False,
)


# ─────────────────────────────────────────────────────────────────────────────
# Inicialização do schema
# ─────────────────────────────────────────────────────────────────────────────

async def init_db() -> None:
    """
    Cria todas as tabelas no banco de dados se ainda não existirem.
    Deve ser chamado uma vez na inicialização da aplicação.

    Não faz migrações — use Alembic para ambientes de produção.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_all_tables() -> None:
    """
    Remove todas as tabelas. ATENÇÃO: destrói dados!
    Uso restrito a testes automatizados.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


# ─────────────────────────────────────────────────────────────────────────────
# Gerenciadores de contexto / injeção de dependência
# ─────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Gerenciador de contexto para uso de sessões fora de endpoints FastAPI.
    Commita ao sair com sucesso; faz rollback em exceção.

    Exemplo:
        async with db_session() as session:
            repo = ContratoRepository(session)
            await repo.salvar(contrato)
    """
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Gerador de sessão para injeção de dependência no FastAPI (Depends).

    Exemplo:
        @app.get("/contratos")
        async def listar(session: AsyncSession = Depends(get_session)):
            repo = ContratoRepository(session)
            return await repo.buscar_por_ente("sao_luis")
    """
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
