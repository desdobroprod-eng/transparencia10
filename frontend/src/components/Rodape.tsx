export default function Rodape() {
  return (
    <footer className="border-t border-gray-200 bg-white mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-xs text-gray-500 space-y-2">
        <p>
          Todos os dados são <strong className="text-gray-700">públicos</strong>, obtidos de fontes
          oficiais: PNCP (contratos), Portal da Transparência do Maranhão (empenhos e servidores
          estaduais), SICONFI/Tesouro Nacional e Receita Federal/BrasilAPI (CNPJ).
        </p>
        <p>
          Os indicadores e cruzamentos são <strong className="text-gray-700">sinalizações automáticas</strong> por
          regras objetivas sobre dados públicos. <strong className="text-gray-700">Não constituem acusação</strong> e
          devem ser investigados pelos órgãos competentes (TCE-MA, CGU, MPF). Homonímia é possível.
        </p>
        <p className="text-gray-400">
          Transparência 10 · fiscalização cidadã das Secretarias de Cultura do Maranhão.
        </p>
      </div>
    </footer>
  );
}
