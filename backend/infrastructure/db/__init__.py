"""
Pacote de infraestrutura de banco de dados — Transparencia10.
Exporta os símbolos mais usados para facilitar importações.
"""
from .models import Alerta, Base, ColetaLog, Contrato, Fornecedor
from .repository import AlertaRepository, ColetaLogRepository, ContratoRepository
from .setup import DATABASE_URL, AsyncSessionFactory, db_session, get_session, init_db

__all__ = [
    # Models
    "Base",
    "Contrato",
    "Alerta",
    "Fornecedor",
    "ColetaLog",
    # Repositories
    "ContratoRepository",
    "AlertaRepository",
    "ColetaLogRepository",
    # Setup
    "init_db",
    "get_session",
    "db_session",
    "AsyncSessionFactory",
    "DATABASE_URL",
]
