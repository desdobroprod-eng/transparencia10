"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Cruzamento } from "@/hooks/useDados";

// Static export: o grafo depende de APIs de browser (canvas, window).
// dynamic + ssr:false garante que NUNCA seja renderizado no prerender.
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

type TipoNo = "empresa" | "pessoa";

interface No {
  id: string;
  rotulo: string;
  tipo: TipoNo;
  // pessoa que também é servidor (em algum cruzamento)
  servidor?: boolean;
}

interface Aresta {
  source: string;
  target: string;
  // "socio" = empresa↔sócio; "match" = sócio↔servidor (a aresta crítica)
  tipo: "socio" | "match";
  exato?: boolean;
}

// Constrói o grafo a partir dos cruzamentos.
// Nós: empresas (cnpj/fornecedor) e pessoas (sócio ∪ servidor).
// Arestas: empresa→sócio ("é sócio de") e sócio→servidor ("também é servidor").
function montarGrafo(cruz: Cruzamento[]) {
  const nos = new Map<string, No>();
  const arestas: Aresta[] = [];

  const idEmpresa = (c: Cruzamento) => `emp:${c.cnpj || c.fornecedor}`;
  const idPessoa = (nome: string) => `pes:${(nome || "").toUpperCase().trim()}`;

  for (const c of cruz) {
    const empId = idEmpresa(c);
    if (!nos.has(empId)) {
      nos.set(empId, {
        id: empId,
        rotulo: c.fornecedor || c.cnpj || "Empresa",
        tipo: "empresa",
      });
    }

    const socioId = idPessoa(c.socio);
    if (!nos.has(socioId)) {
      nos.set(socioId, { id: socioId, rotulo: c.socio, tipo: "pessoa" });
    }

    // aresta empresa↔sócio
    arestas.push({ source: empId, target: socioId, tipo: "socio" });

    // O servidor é a "mesma" pessoa (match exato) ou pessoa distinta (sobrenome).
    const servidorId = c.exato ? socioId : idPessoa(c.servidor);
    if (!nos.has(servidorId)) {
      nos.set(servidorId, {
        id: servidorId,
        rotulo: c.servidor,
        tipo: "pessoa",
      });
    }
    // marca a pessoa como servidor estadual
    const noServ = nos.get(servidorId);
    if (noServ) noServ.servidor = true;

    // aresta crítica "também é servidor estadual"
    if (c.exato) {
      // mesmo nó: registramos a marcação de servidor no próprio nó (acima),
      // mas adicionamos um self-flag via aresta visual só quando há par distinto.
      // Para match exato sócio==servidor não há aresta entre dois nós.
    } else {
      arestas.push({
        source: socioId,
        target: servidorId,
        tipo: "match",
        exato: false,
      });
    }
  }

  return {
    nodes: Array.from(nos.values()),
    links: arestas,
  };
}

export default function GrafoRede({
  cruzamentos,
}: {
  cruzamentos: Cruzamento[];
}) {
  const [montado, setMontado] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(800);

  // Só renderiza no cliente, após mount (proteção extra além do ssr:false).
  useEffect(() => setMontado(true), []);

  // Largura responsiva acompanhando o container.
  useEffect(() => {
    if (!montado) return;
    const el = containerRef.current;
    if (!el) return;
    const medir = () => setLargura(el.clientWidth || 800);
    medir();
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(medir);
      ro.observe(el);
    } else {
      window.addEventListener("resize", medir);
    }
    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", medir);
    };
  }, [montado]);

  const dados = useMemo(() => montarGrafo(cruzamentos), [cruzamentos]);

  const ALTURA = 500;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
      style={{ height: ALTURA }}
    >
      {/* Legenda */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 space-y-1 rounded-lg bg-white/90 px-3 py-2 text-[11px] text-gray-600 shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-500" />
          Empresa contratada
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-600" />
          Pessoa (sócio / servidor)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 bg-red-600" />
          Nome idêntico (indício forte)
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-5 border-t border-dashed border-gray-400"
            style={{ borderTopWidth: 2 }}
          />
          Sobrenome em comum
        </div>
      </div>

      {!montado ? (
        <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
          Carregando grafo…
        </div>
      ) : (
        <ForceGraph2D
          width={largura}
          height={ALTURA}
          graphData={dados}
          backgroundColor="#f9fafb"
          nodeRelSize={5}
          cooldownTicks={120}
          linkWidth={(l) => ((l as Aresta).tipo === "match" ? 2.5 : 1)}
          linkColor={(l) =>
            (l as Aresta).tipo === "match" ? "#dc2626" : "#cbd5e1"
          }
          linkLineDash={(l) =>
            (l as Aresta).tipo === "match" ? null : [4, 3]
          }
          nodeColor={(n) =>
            (n as No).tipo === "empresa" ? "#64748b" : "#2563eb"
          }
          nodeLabel={(n) => {
            const no = n as No;
            const papel =
              no.tipo === "empresa"
                ? "Empresa"
                : no.servidor
                  ? "Servidor estadual"
                  : "Sócio";
            return `${papel}: ${no.rotulo}`;
          }}
          nodeCanvasObjectMode={() => "after"}
          nodeCanvasObject={(node, ctx, scale) => {
            const n = node as No & { x?: number; y?: number };
            // Rótulo só quando há zoom suficiente, para não poluir.
            if (scale < 1.6) return;
            const label = n.rotulo || "";
            if (!label) return;
            const fonte = 4;
            ctx.font = `${fonte}px Inter, system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = "#334155";
            const max = 22;
            const txt = label.length > max ? label.slice(0, max) + "…" : label;
            ctx.fillText(txt, n.x ?? 0, (n.y ?? 0) + 6);
          }}
        />
      )}
    </div>
  );
}
