const tracos = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function IconeCheck() {
  return <svg width="30" height="30" viewBox="0 0 24 24" {...tracos} strokeWidth={2.4} aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>;
}

function IconeAlerta() {
  return <svg width="28" height="28" viewBox="0 0 24 24" {...tracos} aria-hidden="true"><path d="M10.3 4 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0z" /><path d="M12 9.5v4M12 17.2h.01" /></svg>;
}

export function Funil2MobileLoading() {
  return <div className="ape-esqueleto" aria-label="Carregando">
    {[0, 1, 2].map((indice) => <div key={indice}><div className="ape-barra curta" /><div className="ape-barra media" /><div className="ape-barra alta" /></div>)}
  </div>;
}

export function Funil2MobileError({ mensagem, onRetry }: { mensagem: string; onRetry: () => void }) {
  return <div className="ape-estado ruim">
    <span className="ape-estado-icone"><IconeAlerta /></span>
    <strong>Não deu pra carregar sua fila</strong>
    <p>{mensagem}</p>
    <button type="button" onClick={onRetry}>Tentar novamente</button>
  </div>;
}

export function Funil2MobileEmpty({ tipo, onVerCarteira }: { tipo: "dia" | "filtro"; onVerCarteira?: () => void }) {
  return <div className="ape-estado">
    <span className="ape-estado-icone"><IconeCheck /></span>
    <strong>{tipo === "dia" ? "Fila zerada por agora" : "Nenhum cliente neste filtro"}</strong>
    <p>{tipo === "dia" ? "Você respondeu todo mundo que estava esperando hoje. O restante da carteira está no Funil." : "Troque a etapa ou limpe a busca para ver o restante da carteira."}</p>
    {tipo === "dia" && <button type="button" onClick={onVerCarteira}>Ver minha carteira</button>}
  </div>;
}

export type AreaCrmMobile = "funil" | "leads" | "visitas" | "esteira";

export function Funil2MobileNavigation({ area, onArea, onIr }: { area: AreaCrmMobile; onArea: (area: AreaCrmMobile) => void; onIr: (rota: string) => void }) {
  return <nav className="ape-crm-v3-nav" aria-label="Navegação do Funil">
    <button type="button" onClick={() => onIr("/inicio")}>Meu Dia</button>
    <button type="button" className={area === "funil" ? "ativo" : ""} onClick={() => onArea("funil")}>Funil</button>
    <button type="button" className={area === "leads" ? "ativo" : ""} onClick={() => onArea("leads")}>Leads</button>
    <button type="button" onClick={() => onIr("/agenda")}>Agenda</button>
    <button type="button" className={area === "visitas" ? "ativo" : ""} onClick={() => onArea("visitas")}>Visitas</button>
  </nav>;
}
