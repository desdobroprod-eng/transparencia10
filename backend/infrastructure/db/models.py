"""
#10Dobro_Brain
#Ctx_Transparencia10 #Ctx_DB #Ctx_SQLAlchemy

Modelos SQLAlchemy 2.0 — Transparencia10
Compatível com PostgreSQL (produção) e SQLite (desenvolvimento).

Tabelas:
  - Contrato   : contratos públicos coletados via API gov.br
  - Alerta     : anomalias detectadas pelo motor de regras
  - Fornecedor : dados cadastrais de CNPJs consultados
  - ColetaLog  : registro de cada ciclo de coleta de dados
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import JSON


# Base declarativa — ponto de partida para todos os modelos
class Base(DeclarativeBase):
    pass


# Tipo JSON agnóstico: JSONB no Postgres, JSON no SQLite
JsonType = JSON().with_variant(JSONB(), "postgresql")


class Fornecedor(Base):
    """
    Dados cadastrais de um fornecedor (CNPJ).
    Populado via consulta à API ReceitaWS / CNPJ.ws.
    """
    __tablename__ = "fornecedores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cnpj: Mapped[str] = mapped_column(String(14), unique=True, nullable=False, index=True)
    razao_social: Mapped[Optional[str]] = mapped_column(String(300))
    nome_fantasia: Mapped[Optional[str]] = mapped_column(String(300))
    data_abertura: Mapped[Optional[datetime]] = mapped_column(DateTime)
    situacao_cadastral: Mapped[Optional[str]] = mapped_column(String(50))
    # True se constar no CEIS/CNEP na última verificação
    sancionado: Mapped[bool] = mapped_column(Boolean, default=False)
    dados_extras: Mapped[Optional[dict]] = mapped_column(JsonType)
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relacionamentos
    contratos: Mapped[list["Contrato"]] = relationship(
        "Contrato", back_populates="fornecedor_obj", lazy="select"
    )
    alertas: Mapped[list["Alerta"]] = relationship(
        "Alerta", back_populates="fornecedor_obj", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Fornecedor cnpj={self.cnpj} razao={self.razao_social!r}>"


class Contrato(Base):
    """
    Contrato público coletado da API do Portal da Transparência (gov.br).
    Chave de negócio: (numero_contrato, ente).
    """
    __tablename__ = "contratos"
    __table_args__ = (
        # Índice composto para buscas por ente + ano
        Index("ix_contratos_ente_ano", "ente", "ano_exercicio"),
        # Índice para evitar duplicatas de importação
        Index("ix_contratos_numero_ente", "numero_contrato", "ente", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Identificação do contrato
    numero_contrato: Mapped[Optional[str]] = mapped_column(String(100))
    # Chave do ente (ex: "prefeitura_sao_luis")
    ente: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    ano_exercicio: Mapped[Optional[int]] = mapped_column(Integer)

    # Fornecedor
    cnpj_fornecedor: Mapped[Optional[str]] = mapped_column(String(14), index=True)
    nome_fornecedor: Mapped[Optional[str]] = mapped_column(String(300))
    # FK para tabela de fornecedores (pode ser nulo se ainda não cadastrado)
    fornecedor_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("fornecedores.id"), nullable=True
    )
    fornecedor_obj: Mapped[Optional["Fornecedor"]] = relationship(
        "Fornecedor", back_populates="contratos"
    )

    # Dados financeiros
    valor_inicial: Mapped[float] = mapped_column(Float, default=0.0)
    valor_atual: Mapped[Optional[float]] = mapped_column(Float)
    modalidade: Mapped[Optional[str]] = mapped_column(String(100))

    # Objeto e vigência
    objeto_contrato: Mapped[Optional[str]] = mapped_column(Text)
    data_assinatura: Mapped[Optional[datetime]] = mapped_column(DateTime)
    data_inicio_vigencia: Mapped[Optional[datetime]] = mapped_column(DateTime)
    data_fim_vigencia: Mapped[Optional[datetime]] = mapped_column(DateTime)
    situacao: Mapped[Optional[str]] = mapped_column(String(100))
    total_aditivos: Mapped[int] = mapped_column(Integer, default=0)

    # Payload original da API (para rastreabilidade)
    payload_raw: Mapped[Optional[dict]] = mapped_column(JsonType)

    # Score de risco calculado pelo motor de regras
    score_risco: Mapped[int] = mapped_column(Integer, default=0)
    nivel_risco: Mapped[Optional[str]] = mapped_column(String(20))  # normal/baixo/atencao/critico

    coletado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relacionamento com alertas gerados
    alertas: Mapped[list["Alerta"]] = relationship(
        "Alerta", back_populates="contrato_obj", lazy="select"
    )

    def __repr__(self) -> str:
        return (
            f"<Contrato id={self.id} ente={self.ente!r} "
            f"cnpj={self.cnpj_fornecedor!r} valor={self.valor_inicial:,.2f}>"
        )


class Alerta(Base):
    """
    Anomalia detectada pelo motor de regras para um contrato específico.
    Múltiplos alertas podem existir para o mesmo contrato (uma regra por alerta).
    """
    __tablename__ = "alertas"
    __table_args__ = (
        Index("ix_alertas_ente_score", "ente", "score"),
        Index("ix_alertas_regra", "regra"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Vínculo com contrato (pode ser nulo para alertas de nível de ente)
    contrato_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("contratos.id"), nullable=True, index=True
    )
    contrato_obj: Mapped[Optional["Contrato"]] = relationship(
        "Contrato", back_populates="alertas"
    )

    # Vínculo com fornecedor
    cnpj: Mapped[Optional[str]] = mapped_column(String(14), index=True)
    fornecedor_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("fornecedores.id"), nullable=True
    )
    fornecedor_obj: Mapped[Optional["Fornecedor"]] = relationship(
        "Fornecedor", back_populates="alertas"
    )

    # Identificação do ente e da regra disparada
    ente: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    regra: Mapped[str] = mapped_column(String(100), nullable=False)

    # Score e descrição
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    motivo: Mapped[str] = mapped_column(Text, nullable=False)
    dados: Mapped[Optional[dict]] = mapped_column(JsonType)

    # Ciclo de vida do alerta
    revisado: Mapped[bool] = mapped_column(Boolean, default=False)
    revisado_por: Mapped[Optional[str]] = mapped_column(String(200))
    revisado_em: Mapped[Optional[datetime]] = mapped_column(DateTime)
    # Observações do revisor (falso positivo, confirmado, etc.)
    observacao_revisao: Mapped[Optional[str]] = mapped_column(Text)

    detectado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def __repr__(self) -> str:
        return (
            f"<Alerta id={self.id} regra={self.regra!r} "
            f"score={self.score} ente={self.ente!r}>"
        )


class ColetaLog(Base):
    """
    Registro de cada ciclo de coleta de dados — auditoria e diagnóstico.
    Um registro por execução do job de coleta.
    """
    __tablename__ = "coleta_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Quando a coleta foi iniciada e encerrada
    iniciada_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    encerrada_em: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Ente coletado (None = coleta global de todos os entes)
    ente: Mapped[Optional[str]] = mapped_column(String(100), index=True)

    # Métricas da coleta
    total_registros: Mapped[int] = mapped_column(Integer, default=0)
    total_novos: Mapped[int] = mapped_column(Integer, default=0)
    total_atualizados: Mapped[int] = mapped_column(Integer, default=0)
    total_alertas_gerados: Mapped[int] = mapped_column(Integer, default=0)

    # Status: "sucesso" | "parcial" | "erro"
    status: Mapped[str] = mapped_column(String(20), default="sucesso")

    # Lista de erros ocorridos durante a coleta
    erros: Mapped[Optional[dict]] = mapped_column(JsonType)

    # Duração em segundos
    duracao_segundos: Mapped[Optional[float]] = mapped_column(Float)

    def __repr__(self) -> str:
        return (
            f"<ColetaLog id={self.id} ente={self.ente!r} "
            f"status={self.status!r} registros={self.total_registros}>"
        )
