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
 * DEEP LINK VENCE A VISTA. Ver o comentário de `entrouPorDeepLink` abaixo.
 */
import { useEffect, useState, type ReactNode } from "react";
import { NOVA_CRM_CSS } from "./styles";
import { crmNovaEraLiberado } from "./featureFlag";
import { Crm3Workspace } from "../crm-nova-era-3/Crm3Workspace";
import { TelaCrmMobile } from "./TelaCrmMobile";
import { useEhCelular } from "../system/useFormato";

type Variante = "atual" | "nova-era";
type Profile = { userId: string | null; role: string | null; name: string | null };

function chave(userId: string | null) {
  return `ncrm:variante:${userId ?? "anon"}`;
}

/* A URL chegou pedindo uma ficha ou uma conversa?
 *
 * `?lead=` e `?chat=` são traduzidos pela página de CRM em props do
 * CrmWorkspace. Nenhuma das outras vistas sabe lê-los: a TelaCrmMobile é uma
 * lista (sem ficha, sem chat) e o Crm3Workspace só entende `?aba=`. */
function pedeFichaOuConversa(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const p = new URLSearchParams(window.location.search);
    return p.has("lead") || p.has("chat");
  } catch {
    return false;
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
   * Por que guardar em vez de reler a URL a cada render: a página de CRM
   * apaga a query assim que o deep link é consumido (`limpar`), para o botão
   * voltar não reabrir o mesmo lead. Se este valor fosse relido, a ficha
   * abriria e a tela inteira se trocaria por baixo dela no mesmo instante. */
  const [entrouPorDeepLink] = useState(pedeFichaOuConversa);
  const [entrouNoWorkspace3] = useState(pedeWorkspace3);

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

  /* ---------------------- FICHA / CONVERSA PEDIDA ----------------------
     A ficha e a conversa só existem dentro do CrmWorkspace. Este era o furo:
     no celular o gate trocava a tela inteira pela TelaCrmMobile e o
     CrmWorkspace nunca montava, então `?chat=` e `?lead=` morriam na URL --
     o gestor tocava em "Abrir conversa" na tela de Início e caía na lista,
     sem erro nenhum na tela nem no console.

     Monta o CrmWorkspace PURO, sem a barra "Funil atual / CRM Nova Era 3.0":
     ela é vocabulário de piloto e o pacote de design a proíbe na tela do
     corretor. Vale para os dois formatos -- o Crm3Workspace também não sabe
     abrir ficha por id, então no desktop o deep link morria igual. */
  if (entrouPorDeepLink) return <>{current}</>;

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
      <>
        <style>{NOVA_CRM_CSS}</style>
        <TelaCrmMobile
          accessToken={accessToken as string}
          nome={profile?.name ?? "Corretor"}
          onAbrirLead={(id) => {
            /* Mesmo deep link que a página de CRM já sabe traduzir. Sem rota
               nova e sem estado paralelo: a ficha continua sendo a de sempre.
               Recarrega de propósito (`assign`, não router): a ficha vive no
               CrmWorkspace, e é a montagem nova que faz o gate acima ver o
               `lead=` e montar quem sabe abri-la. */
            if (typeof window !== "undefined") window.location.assign(`/crm?lead=${id}&crm=nova-era`);
          }}
          onIr={(destino) => { if (typeof window !== "undefined") window.location.assign(destino); }}
        />
      </>
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
