"use client";

export type MobileCrmArea = "carteira" | "vendas" | "visitas" | "avisos";

const areas: ReadonlyArray<{ id: MobileCrmArea; label: string; href: string }> = [
  { id: "carteira", label: "Carteira", href: "/crm" },
  { id: "vendas", label: "Esteira", href: "/crm?vista=vendas" },
  { id: "visitas", label: "Visitas", href: "/agenda" },
  { id: "avisos", label: "Avisos", href: "/notificacoes" },
];

export function MobileCrmNavigation({
  areaAtual,
  onIr,
}: {
  areaAtual: MobileCrmArea;
  onIr: (destino: string) => void;
}) {
  return <nav className="ape-mobile-mais-areas" aria-label="Áreas do CRM">
    {areas.map((area) => <button
      key={area.id}
      type="button"
      className={areaAtual === area.id ? "ativo" : ""}
      aria-current={areaAtual === area.id ? "page" : undefined}
      onClick={() => onIr(area.href)}
    >{area.label}</button>)}
  </nav>;
}
