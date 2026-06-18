"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoIcon } from "@/components/Logo";

const LINKS = [
  { href: "/", label: "Visão Geral" },
  { href: "/contratos", label: "Contratos" },
  { href: "/empresas", label: "Empresas" },
  { href: "/cruzamentos", label: "Coincidências de Nomes" },
  { href: "/metodologia", label: "Metodologia" },
];

const BASE = "/transparencia10";

export default function NavBar() {
  const pathname = usePathname();
  // Normaliza removendo o basePath e trailing slash para comparar
  const atual = (pathname || "/").replace(BASE, "").replace(/\/$/, "") || "/";

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <LogoIcon size={28} />
            <span className="text-base font-bold text-gray-900 tracking-tight">Transparência Cultural</span>
            <span className="hidden sm:inline text-xs text-gray-400">· do Brasil</span>
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {LINKS.map((l) => {
              const ativo = l.href === "/" ? atual === "/" : atual.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                    ativo
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
