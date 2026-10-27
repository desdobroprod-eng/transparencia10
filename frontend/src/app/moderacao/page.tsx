import type { Metadata } from "next";
import PainelModeracao from "@/components/fiscalizacao/PainelModeracao";

// Página interna: fora dos buscadores e fora do menu.
export const metadata: Metadata = {
  title: "Moderação",
  robots: { index: false, follow: false },
};

export default function ModeracaoPage() {
  return <PainelModeracao />;
}
