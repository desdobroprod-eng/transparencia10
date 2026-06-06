"""
#10Dobro_Brain
#Ctx_Transparencia10 #Ctx_DB #Ctx_Repository

Repositórios de acesso a dados — Transparencia10.
Encapsulam toda lógica de persistência; o domínio não importa SQLAlchemy diretamente.

Padrão: AsyncSession do SQLAlchemy 2.0 com queries explícitas (select/update).
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional, Sequence

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Alerta, ColetaLog, Contrato, Fornecedor


# ─────────────────────────────────────────────────────────────────────────────
# ContratoRepository
# ─────────────────────────────────────────────────────────────────────────────

class ContratoRepository:
    """Operações de persistência e consulta de contratos."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def salvar(self, contrato: Contrato) -> Contrato:
        """Insere ou atualiza um contrato. Retorna o objeto persistido."""
        self.session.add(contrato)
        await self.session.flush()  # Obtém o ID sem commitar
        return contrato

    async def salvar_varios(self, contratos: list[Contrato]) -> None:
        """Persiste uma lista de contratos em lote (bulk)."""
        for c in contratos:
            self.session.add(c)
        await self.session.flush()

    async def buscar_por_id(self, contrato_id: int) -> Optional[Contrato]:
        """Retorna contrato pelo ID primário."""
        return await self.session.get(Contrato, contrato_id)

    async def buscar_por_ente(
        self,
        ente: str,
        ano: Optional[int] = None,
        limite: int = 500,
        offset: int = 0,
    ) -> Sequence[Contrato]:
        """
        Retorna contratos de um ente específico.
        Filtragem opcional por ano de exercício.
        """
        stmt = select(Contrato).where(Contrato.ente == ente)
        if ano:
            stmt = stmt.where(Contrato.ano_exercicio == ano)
        stmt = stmt.order_by(Contrato.valor_inicial.desc()).limit(limite).offset(offset)
        resultado = await self.session.execute(stmt)
        return resultado.scalars().all()

    async def buscar_por_cnpj(
        self,
        cnpj: str,
        ente: Optional[str] = None,
    ) -> Sequence[Contrato]:
        """
        Retorna todos os contratos de um CNPJ.
        Opcionalmente restringe ao ente informado.
        """
        stmt = select(Contrato).where(Contrato.cnpj_fornecedor == cnpj[:14])
        if ente:
            stmt = stmt.where(Contrato.ente == ente)
        stmt = stmt.order_by(Contrato.data_assinatura.desc())
        resultado = await self.session.execute(stmt)
        return resultado.scalars().all()

    async def buscar_historico_similares(
        self,
        palavras_chave: list[str],
        excluir_id: Optional[int] = None,
        limite: int = 200,
    ) -> Sequence[Contrato]:
        """
        Retorna contratos cujo objeto contenha ao menos uma das palavras-chave.
        Usado por `verificar_preco_abusivo` para comparação de preços.
        """
        # Monta filtro OR de LIKE para cada palavra-chave
        from sqlalchemy import or_
        filtros = [
            Contrato.objeto_contrato.ilike(f"%{p}%")
            for p in palavras_chave
            if len(p) > 3
        ]
        if not filtros:
            return []

        stmt = select(Contrato).where(or_(*filtros))
        if excluir_id:
            stmt = stmt.where(Contrato.id != excluir_id)
        stmt = stmt.limit(limite)
        resultado = await self.session.execute(stmt)
        return resultado.scalars().all()

    async def buscar_por_numero_e_ente(
        self, numero: str, ente: str
    ) -> Optional[Contrato]:
        """Verifica existência de contrato pelo número + ente (evita duplicatas)."""
        stmt = select(Contrato).where(
            Contrato.numero_contrato == numero,
            Contrato.ente == ente,
        )
        resultado = await self.session.execute(stmt)
        return resultado.scalar_one_or_none()

    async def atualizar_score(
        self, contrato_id: int, score: int, nivel: str
    ) -> None:
        """Atualiza o score de risco de um contrato já persistido."""
        stmt = (
            update(Contrato)
            .where(Contrato.id == contrato_id)
            .values(score_risco=score, nivel_risco=nivel, atualizado_em=datetime.utcnow())
        )
        await self.session.execute(stmt)

    async def contar_por_ente(self, ente: str) -> int:
        """Retorna a quantidade total de contratos de um ente."""
        stmt = select(func.count()).select_from(Contrato).where(Contrato.ente == ente)
        resultado = await self.session.execute(stmt)
        return resultado.scalar_one()


# ─────────────────────────────────────────────────────────────────────────────
# AlertaRepository
# ─────────────────────────────────────────────────────────────────────────────

class AlertaRepository:
    """Operações de persistência e consulta de alertas."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def salvar(self, alerta: Alerta) -> Alerta:
        """Persiste um alerta e retorna o objeto com ID preenchido."""
        self.session.add(alerta)
        await self.session.flush()
        return alerta

    async def salvar_varios(self, alertas: list[Alerta]) -> None:
        """Persiste lista de alertas em lote."""
        for a in alertas:
            self.session.add(a)
        await self.session.flush()

    async def buscar_por_id(self, alerta_id: int) -> Optional[Alerta]:
        """Retorna alerta pelo ID primário."""
        return await self.session.get(Alerta, alerta_id)

    async def buscar_por_ente(
        self,
        ente: str,
        score_minimo: int = 0,
        apenas_nao_revisados: bool = False,
        limite: int = 200,
        offset: int = 0,
    ) -> Sequence[Alerta]:
        """
        Retorna alertas de um ente, opcionalmente filtrados por score
        e estado de revisão. Ordenados por score decrescente.
        """
        stmt = select(Alerta).where(Alerta.ente == ente)
        if score_minimo > 0:
            stmt = stmt.where(Alerta.score >= score_minimo)
        if apenas_nao_revisados:
            stmt = stmt.where(Alerta.revisado.is_(False))
        stmt = stmt.order_by(Alerta.score.desc()).limit(limite).offset(offset)
        resultado = await self.session.execute(stmt)
        return resultado.scalars().all()

    async def buscar_por_regra(
        self,
        regra: str,
        ente: Optional[str] = None,
        score_minimo: int = 0,
    ) -> Sequence[Alerta]:
        """Retorna todos os alertas de uma regra específica."""
        stmt = select(Alerta).where(Alerta.regra == regra)
        if ente:
            stmt = stmt.where(Alerta.ente == ente)
        if score_minimo:
            stmt = stmt.where(Alerta.score >= score_minimo)
        stmt = stmt.order_by(Alerta.detectado_em.desc())
        resultado = await self.session.execute(stmt)
        return resultado.scalars().all()

    async def buscar_por_contrato(self, contrato_id: int) -> Sequence[Alerta]:
        """Retorna todos os alertas associados a um contrato específico."""
        stmt = (
            select(Alerta)
            .where(Alerta.contrato_id == contrato_id)
            .order_by(Alerta.score.desc())
        )
        resultado = await self.session.execute(stmt)
        return resultado.scalars().all()

    async def marcar_revisado(
        self,
        alerta_id: int,
        revisado_por: str,
        observacao: Optional[str] = None,
    ) -> bool:
        """
        Marca um alerta como revisado.
        Retorna True se o alerta existia e foi atualizado.
        """
        stmt = (
            update(Alerta)
            .where(Alerta.id == alerta_id)
            .values(
                revisado=True,
                revisado_por=revisado_por,
                revisado_em=datetime.utcnow(),
                observacao_revisao=observacao,
            )
        )
        resultado = await self.session.execute(stmt)
        return resultado.rowcount > 0  # type: ignore[return-value]

    async def contar_por_ente_e_nivel(
        self, ente: str
    ) -> dict[str, int]:
        """
        Retorna contagem de alertas por nível de score para um ente.
        Retorna dict: {"critico": N, "atencao": N, "baixo": N}
        """
        resultado: dict[str, int] = {"critico": 0, "atencao": 0, "baixo": 0}
        stmt = select(Alerta.score).where(Alerta.ente == ente)
        res = await self.session.execute(stmt)
        for (score,) in res:
            if score >= 80:
                resultado["critico"] += 1
            elif score >= 60:
                resultado["atencao"] += 1
            else:
                resultado["baixo"] += 1
        return resultado

    async def total_nao_revisados(self) -> int:
        """Retorna total global de alertas ainda não revisados."""
        stmt = select(func.count()).select_from(Alerta).where(Alerta.revisado.is_(False))
        resultado = await self.session.execute(stmt)
        return resultado.scalar_one()


# ─────────────────────────────────────────────────────────────────────────────
# ColetaLogRepository
# ─────────────────────────────────────────────────────────────────────────────

class ColetaLogRepository:
    """Operações de persistência e consulta de logs de coleta."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def iniciar_coleta(self, ente: Optional[str] = None) -> ColetaLog:
        """
        Cria e persiste um registro de coleta no estado inicial.
        Retorna o objeto para que seja atualizado ao final.
        """
        log = ColetaLog(
            ente=ente,
            iniciada_em=datetime.utcnow(),
            status="em_andamento",
        )
        self.session.add(log)
        await self.session.flush()
        return log

    async def encerrar_coleta(
        self,
        log: ColetaLog,
        total_registros: int,
        total_novos: int,
        total_atualizados: int,
        total_alertas_gerados: int,
        status: str = "sucesso",
        erros: Optional[list[dict]] = None,
    ) -> ColetaLog:
        """
        Atualiza o log de coleta com os resultados finais.
        status: "sucesso" | "parcial" | "erro"
        """
        agora = datetime.utcnow()
        log.encerrada_em = agora
        log.total_registros = total_registros
        log.total_novos = total_novos
        log.total_atualizados = total_atualizados
        log.total_alertas_gerados = total_alertas_gerados
        log.status = status
        log.erros = {"lista": erros} if erros else None
        log.duracao_segundos = (agora - log.iniciada_em).total_seconds()
        await self.session.flush()
        return log

    async def registrar(
        self,
        *,
        ente: Optional[str] = None,
        total_registros: int,
        total_novos: int = 0,
        total_atualizados: int = 0,
        total_alertas_gerados: int = 0,
        status: str = "sucesso",
        erros: Optional[list[str]] = None,
        iniciada_em: Optional[datetime] = None,
    ) -> ColetaLog:
        """
        Atalho para registrar uma coleta já concluída de uma vez.
        Útil para migrações e testes.
        """
        inicio = iniciada_em or datetime.utcnow()
        fim = datetime.utcnow()
        log = ColetaLog(
            ente=ente,
            iniciada_em=inicio,
            encerrada_em=fim,
            total_registros=total_registros,
            total_novos=total_novos,
            total_atualizados=total_atualizados,
            total_alertas_gerados=total_alertas_gerados,
            status=status,
            erros={"lista": erros} if erros else None,
            duracao_segundos=(fim - inicio).total_seconds(),
        )
        self.session.add(log)
        await self.session.flush()
        return log

    async def ultimas_coletas(
        self, limite: int = 20, ente: Optional[str] = None
    ) -> Sequence[ColetaLog]:
        """Retorna os N logs mais recentes, opcionalmente filtrados por ente."""
        stmt = select(ColetaLog)
        if ente:
            stmt = stmt.where(ColetaLog.ente == ente)
        stmt = stmt.order_by(ColetaLog.iniciada_em.desc()).limit(limite)
        resultado = await self.session.execute(stmt)
        return resultado.scalars().all()

    async def ultima_coleta_sucesso(self, ente: Optional[str] = None) -> Optional[ColetaLog]:
        """Retorna o log da última coleta bem-sucedida."""
        stmt = select(ColetaLog).where(ColetaLog.status == "sucesso")
        if ente:
            stmt = stmt.where(ColetaLog.ente == ente)
        stmt = stmt.order_by(ColetaLog.iniciada_em.desc()).limit(1)
        resultado = await self.session.execute(stmt)
        return resultado.scalar_one_or_none()
