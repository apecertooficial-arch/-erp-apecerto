"use client";
/**
 * CrmNovaEraGate — SELETOR entre o CRM atual e o CRM Nova Era 3.0.
 * ------------------------------------------------------------------
 * - Gate real: só exibe a opção "CRM Nova Era" quando `crmNovaEraLiberado`
 *   (flag do ambiente ligada E (admin OU allowlist)). Corretor sem permissão
 *   vê APENAS o CRM antigo. Acesso direto por ?crm=nova-era é bloqueado quando
 *   não liberado (cai no CRM antigo e limpa a query).
 * - A flag controla só a VISIBILIDADE; a autorização de dados é sempre do banco
 *   (RLS + RPC fail-closed). Nenhum segredo/serviço aqui.
 * - Persiste a última escolha por usuário (localStorage), sem afetar os demais.
 * - Default: "Funil atual" (CRM de produção inalterado).
 *
 * CELULAR: monta a TelaCrmMobile, no desenho do protótipo. Antes, celular e
 * desktop caíam os dois no Crm3Workspace, que foi feito para tela grande.
 *
 * DEEP LINK VENCE A VISTA. Ver o comentário de `deepLink` abaixo.
 */
import { useEffect, useState, type ReactNode } from "react";
import { NOVA_CRM_CSS } from "./styles";
import { crmNovaEraLiberado } from "./featureFlag";
import { Crm3Workspace } from "../crm-nova-era-3/Crm3Workspace";
import { useEhCelular } from "../system/useFormato";
import { Funil2Workspace } from "../funil-2/Funil2Workspace";

type Variante = "atual" | "nova-era";
type Profile = { userId: string | null; role: string | null; name: string | null };

function chave(userId: string | null) {
  return `ncrm:variante:${userId ?? "anon"}`;
}

/* A URL chegou pedindo uma ficha ou uma conversa? OS DOIS TÊM DONOS
 * DIFERENTES, e é por isso que a leitura é separada:
 *
 * `?chat=` (a conversa) só existe dentro do CrmWorkspace — em qualquer
 * formato de tela, é para lá que ele vai.
 *
 * `?lead=` (a ficha) tem duas casas: no desktop é o CrmWorkspace; no celular
 * é a FichaLeadMobile, que a TelaCrmMobile abre lendo este mesmo parâmetro.
 * É o link que o PUSH de lead novo carrega — mandar o corretor para o CRM de
 * desktop no celular era recarga de página + ~1,8 MB de /api/crm + um
 * `if (!deal) return;` mudo quando o negócio não estava naquele payload. */
function lerDeepLink(): { chat: boolean; lead: boolean } {
  if (typeof window === "undefined") return { chat: false, lead: false };
  try {
    const p = new URLSearchParams(window.location.search);
    return { chat: p.has("chat"), lead: p.has("lead") };
  } catch {
    return { chat: false, lead: false };
  }
}

/** No celular, aba explícita significa que o usuário pediu a tela 3.0 real. */
function pedeWorkspace3(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return ["funil", "leads", "visitas", "esteira", "agenda", "avisos", "gestao"].includes(
      new URLSearchParams(window.location.search).get("aba") ?? "",
    );
  } catch {
    return false;
  }
}

function pedeFunil2(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("crm") === "funil-2";
  } catch {
    return false;
  }
}

function escolhaSalva(userId: string | null): Variante {
  /* Desde 31/07 o 3.0 é o CRM oficial: padrão para TODOS, em qualquer tela.
     O CRM antigo só abre pelo atalho explícito ?crm=atual (rota de emergência
     da gestão) — escolha salva no aparelho deixou de contar, senão quem um dia
     clicou em "Funil atual" ficaria preso no passado. */
  void userId;
  if (typeof window === "undefined") return "nova-era";
  try {
    if (new URLSearchParams(window.location.search).get("crm") === "atual") return "atual";
    return "nova-era";
  } catch {
    return "nova-era";
  }
}

function refletirUrl(v: Variante, userId: string | null) {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (v === "nova-era") url.searchParams.set("crm", "nova-era");
    else url.searchParams.delete("crm");
    window.history.replaceState(null, "", url.toString());
    window.localStorage.setItem(chave(userId), v);
  } catch {
    /* no-op */
  }
}

export function CrmNovaEraGate({
  current,
  accessToken,
  profile,
}: {
  current: ReactNode;
  accessToken?: string | null;
  profile?: Profile;
}) {
  const liberado = crmNovaEraLiberado(profile?.userId ?? null, { role: profile?.role ?? null });
  // Escolha inicial já considerando o gate (sem setState em efeito).
  const [variante, setVariante] = useState<Variante>(() => (liberado ? escolhaSalva(profile?.userId ?? null) : "atual"));

  /* DEEP LINK: lido UMA vez, na montagem, e guardado.
   *
   * Por que guardar em vez de reler a URL a cada render: quem consome o deep
   * link apaga a query (a página de CRM no desktop, a TelaCrmMobile no
   * celular), para o botão voltar não reabrir o mesmo lead. Se este valor
   * fosse relido, a ficha abriria e a tela inteira se trocaria por baixo
   * dela no mesmo instante. */
  const [deepLink] = useState(lerDeepLink);
  const [entrouNoWorkspace3] = useState(pedeWorkspace3);
  const [entrouNoFunil2] = useState(pedeFunil2);

  /* null durante a primeira renderização no servidor: não dá para adivinhar a
     largura antes de o navegador existir, e chutar causaria troca de tela
     piscando na frente do corretor. */
  const ehCelular = useEhCelular();

  // Se não liberado, apenas limpa ?crm=nova-era da URL (sync com sistema externo — sem setState).
  useEffect(() => {
    if (!liberado) refletirUrl("atual", profile?.userId ?? null);
  }, [liberado, profile?.userId]);

  // Não liberado: nada de Nova Era, nem seletor — CRM antigo puro.
  if (!liberado) return <>{current}</>;

  const podeLive = !!accessToken && !!profile?.userId;
  const podeFunil2 = profile?.userId === "4dfdffae-0009-41de-8d6f-2365a06dc066"
    || ["admin", "executivo"].includes((profile?.role ?? "").toLowerCase());

  /* Laboratório isolado: entrada explícita e administrativa. A mesma regra é
     repetida no banco; esconder a tela aqui é UX, RLS é a autoridade. */
  if (entrouNoFunil2) {
    if (!podeLive || !podeFunil2) return <>{current}</>;
    return (
      <Funil2Workspace
        accessToken={accessToken as string}
        profile={{ userId: profile!.userId as string, role: profile?.role ?? "admin", name: profile?.name ?? "Administrador" }}
      />
    );
  }

  /* ---------------------- CONVERSA PEDIDA (?chat=) ----------------------
     A conversa só existe dentro do CrmWorkspace. Monta ele PURO, sem a barra
     "Funil atual / CRM Nova Era 3.0" — vocabulário de piloto, proibido na
     tela do corretor. Vale para os dois formatos. */
  if (deepLink.chat) return <>{current}</>;

  /* ---------------------- FICHA PEDIDA (?lead=) ----------------------
     No desktop, a ficha é a do CrmWorkspace — mesmo caminho da conversa.
     No celular, quem sabe abrir a ficha é a TelaCrmMobile: deixa o fluxo
     SEGUIR para o ramo do celular logo abaixo, onde ela monta e lê o
     parâmetro. Enquanto a largura é desconhecida (primeiro quadro), não
     monta nada: chutar desktop dispararia o download de ~1,8 MB de
     /api/crm num aparelho que nunca vai usar essa tela. */
  if (deepLink.lead) {
    if (ehCelular === null) return null;
    if (ehCelular === false) return <>{current}</>;
  }

  /* Funil/Leads/Visitas solicitados no celular usam o mesmo workspace do
     desktop, que já é responsivo. Isso elimina a falsa navegação que voltava
     para Meu Dia e garante uma única fonte de verdade. */
  if (entrouNoWorkspace3 && podeLive) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <style>{NOVA_CRM_CSS}</style>
        <Crm3Workspace
          accessToken={accessToken as string}
          profile={{ userId: profile!.userId as string, role: profile?.role ?? "corretor", name: profile?.name ?? "Corretor" }}
        />
      </div>
    );
  }

  function escolher(v: Variante) {
    setVariante(v);
    refletirUrl(v, profile?.userId ?? null);
  }

  /* ------------------------------ CELULAR ------------------------------
     Tela própria, no desenho do protótipo. A barra "Funil atual / CRM Nova
     Era 3.0" NÃO aparece aqui: é vocabulário de piloto, e o pacote de design
     proíbe isso na tela do corretor. No desktop ela continua, porque lá é
     ferramenta de quem está comparando as duas versões. */
  if (ehCelular === true && variante === "nova-era" && podeLive) {
    return (
      <Funil2Workspace
        accessToken={accessToken as string}
        profile={{ userId: profile!.userId as string, role: profile?.role ?? "corretor", name: profile?.name ?? "Corretor" }}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <style>{NOVA_CRM_CSS}</style>

      {/* A barra de comparação aposentou-se com o CRM antigo: o 3.0 é o CRM.
          O antigo ainda abre por ?crm=atual (emergência da gestão) e, só
          nesse caso, mostramos o caminho de volta. */}
      {variante === "atual" && (
        <div className="nova-crm-topbar" style={{ borderBottom: "1px solid var(--nc-line)" }}>
          <div className="nova-crm-seg" role="tablist" aria-label="Selecionar experiência de CRM">
            <button className="on" onClick={() => escolher("atual")} role="tab" aria-selected>
              Funil antigo (consulta)
            </button>
            <button onClick={() => escolher("nova-era")} role="tab" aria-selected={false}>
              Voltar ao CRM <span className="nova-crm-badge-exp" style={{ marginLeft: 6 }}>3.0</span>
            </button>
          </div>
          <span className="nova-crm-seghint">O CRM oficial agora é o 3.0 — esta tela antiga é somente consulta.</span>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        {variante === "atual" ? (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{current}</div>
        ) : podeLive ? (
          <Crm3Workspace
            accessToken={accessToken as string}
            profile={{ userId: profile!.userId as string, role: profile?.role ?? "corretor", name: profile?.name ?? "Corretor" }}
          />
        ) : (
          <div className="nova-crm-empty">Sessão necessária para carregar o CRM Nova Era.</div>
        )}
      </div>
    </div>
  );
}
