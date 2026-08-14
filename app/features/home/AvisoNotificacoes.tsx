"use client";
/* AVISO DE LEAD NOVO — faixa que liga a notificacao no celular do corretor.
 *
 * Aparece no topo do Meu Dia e some assim que o aparelho esta inscrito. Nao e
 * um banner de marketing: sem ele o corretor so descobre o lead novo se abrir o
 * aplicativo por conta propria, e o tempo de primeira resposta e a metrica que
 * mais pesa na conversao.
 *
 * NAO pedimos permissao sozinhos na carga da pagina. O navegador penaliza site
 * que faz isso e, pior, se o corretor negar por reflexo a permissao trava e so
 * ele reverte nas configuracoes do aparelho. Por isso: primeiro a faixa
 * explicando o porque, o pedido do navegador so depois do toque.
 *
 * ESTILO: classe propria (.aviso-push-*), NAO .convite-instalar. Aquela e
 * mobile-only (display:none acima de 900px em app-mobile.css): no desktop a
 * faixa existia no DOM e ficava invisivel, entao o navegador nunca chegava a
 * pedir permissao e ninguem conseguia se inscrever. Legado:
 * ja e a linguagem visual de faixa informativa do aplicativo -- criar uma classe
 * nova seria uma segunda linguagem para a mesma coisa.
 *
 * CONTRATO: a notificacao carrega titulo curto e link. Nao carrega nome de
 * cliente, telefone nem conversa -- o payload passa por servidor de terceiro
 * (Google/Apple) antes de chegar no aparelho.
 */
import { useCallback, useEffect, useState } from "react";
import {
  chaveParaBytes, extrairInscricao, lerEstado, type EstadoPush,
} from "../crm-nova-era/lib/pushCliente";

/* DISPENSA QUE GRUDA (ago/2026).
 *
 * O cartao de "negado" nao tinha botao de fechar: quem bloqueou a notificacao
 * ficava com ele preso na tela, em cima do conteudo, em toda navegacao. E o
 * corretor nao consegue resolver isso de dentro do aplicativo -- depende das
 * configuracoes do navegador. Insistir a cada carregamento e so ruido, e ruido
 * em cima da tela de trabalho.
 *
 * O fechar de antes tambem nao segurava: era estado de componente, entao voltava
 * no proximo recarregamento. Agora a dispensa fica gravada no aparelho com
 * prazo. Prazos diferentes de proposito: quando o conserto esta fora do
 * aplicativo (navegador bloqueou, iPhone sem instalar) nao adianta insistir
 * cedo; quando basta um toque para ligar, vale voltar a oferecer antes.
 *
 * localStorage e nao cookie: e preferencia de aparelho, nao de conta -- o mesmo
 * corretor pode ter o aviso ligado no celular e bloqueado no computador. */
const DIAS_DISPENSA: Record<string, number> = { negado: 30, ios_sem_instalar: 30, pode_pedir: 7 };
const chaveDispensa = (estado: string) => `apecerto:aviso-push-dispensado:${estado}`;

function dispensaValida(estado: string): boolean {
  const dias = DIAS_DISPENSA[estado];
  if (!dias) return false;
  try {
    const bruto = window.localStorage.getItem(chaveDispensa(estado));
    if (!bruto) return false;
    const quando = Number(bruto);
    if (!Number.isFinite(quando)) return false;
    return Date.now() - quando < dias * 86400000;
  } catch { return false; } /* modo privativo / storage bloqueado: mostra o aviso */
}

function gravarDispensa(estado: string) {
  try { window.localStorage.setItem(chaveDispensa(estado), String(Date.now())); } catch { /* sem storage: vale so nesta sessao */ }
}

export function AvisoNotificacoes({ accessToken }: { accessToken: string }) {
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [ocupado, setOcupado] = useState(false);
  /* O cartao nao pode morar na tela. A confirmacao some sozinha depois de alguns
     segundos, e o convite pode ser dispensado -- quem nao quer agora nao deve
     ficar tropecando nele o dia inteiro. */
  const [dispensado, setDispensado] = useState(false);
  /* Fechar grava no aparelho: sem isto o cartao voltaria no proximo carregamento
     e o botao seria decorativo. */
  const dispensar = useCallback((qual: string) => { gravarDispensa(qual); setDispensado(true); }, []);

  /* Some sozinho 6s depois de confirmar. Temporizador, nao onAnimationEnd: com
     prefers-reduced-motion a animacao nao roda e o cartao ficaria para sempre. */
  useEffect(() => {
    if (estado !== "ligado") return;
    const t = window.setTimeout(() => setDispensado(true), 6000);
    return () => window.clearTimeout(t);
  }, [estado]);
  const [erro, setErro] = useState<string | null>(null);

  /* Diagnostico na montagem: nada de pedir permissao aqui. */
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const temSW = typeof navigator !== "undefined" && "serviceWorker" in navigator;
      const temPM = typeof window !== "undefined" && "PushManager" in window;
      let jaInscrito = false;
      if (temSW && temPM) {
        try {
          const reg = await navigator.serviceWorker.ready;
          jaInscrito = (await reg.pushManager.getSubscription()) != null;
        } catch { jaInscrito = false; }
      }
      const standalone =
        typeof window !== "undefined" &&
        (window.matchMedia?.("(display-mode: standalone)").matches ||
          // iOS antigo usa esta propriedade fora do padrao
          (navigator as unknown as { standalone?: boolean }).standalone === true);

      const e = lerEstado({
        temServiceWorker: temSW,
        temPushManager: temPM,
        permissao: typeof Notification !== "undefined" ? Notification.permission : null,
        jaInscrito,
        ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
        standalone: Boolean(standalone),
      });
      if (!vivo) return;
      /* Ja dispensado neste aparelho e ainda dentro do prazo: nem chega a montar. */
      if (dispensaValida(e)) setDispensado(true);
      setEstado(e);
    })();
    return () => { vivo = false; };
  }, []);

  const ligar = useCallback(async () => {
    setOcupado(true); setErro(null);
    try {
      /* A permissao TEM de ser pedida dentro do gesto do usuario. Buscar a
         chave antes deixaria o await no meio e alguns navegadores descartam o
         pedido por perder o vinculo com o toque. */
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setEstado(permissao === "denied" ? "negado" : "pode_pedir");
        return;
      }

      const rc = await fetch("/api/ncrm/push/chave", { headers: { Authorization: `Bearer ${accessToken}` } });
      const cj = (await rc.json().catch(() => ({}))) as { chave?: string };
      if (!rc.ok || !cj.chave) { setErro("Servidor sem chave de notificação configurada."); return; }

      const reg = await navigator.serviceWorker.ready;
      /* Reaproveita a inscricao existente: chamar subscribe duas vezes com
         chaves diferentes estoura InvalidStateError. */
      const sub = (await reg.pushManager.getSubscription())
        ?? (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: Uint8Array.from(chaveParaBytes(cj.chave)).buffer,
        }));

      const dados = extrairInscricao(sub, navigator.userAgent);
      if (!dados) { setErro("O navegador não devolveu as chaves do aparelho."); return; }

      const r = await fetch("/api/ncrm/push/registrar", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });
      if (!r.ok) { setErro("Não foi possível registrar este aparelho."); return; }

      setEstado("ligado");
    } catch {
      setErro("Não foi possível ligar os avisos neste aparelho.");
    } finally {
      setOcupado(false);
    }
  }, [accessToken]);

  if (estado === null || estado === "nao_suportado" || dispensado) return null;

  /* Antes o componente desaparecia depois da inscricao. Para o corretor isso
     parecia uma falha: nao havia nenhum lugar dizendo que o aparelho estava
     realmente pronto para receber um lead. O estado ligado fica compacto e
     verificavel, sem tomar a tela nem pedir permissao novamente. */
  if (estado === "ligado") {
    return (
      <div className="aviso-push-ok aviso-push-some" role="status" aria-label="Avisos de lead novo ligados">
        <span aria-hidden="true">✓</span>
        <div>
          <strong>Avisos de lead novo ligados</strong>
          <p>Este aparelho vai avisar quando um lead cair para você.</p>
        </div>
      </div>
    );
  }

  if (estado === "ios_sem_instalar") {
    return (
      <div className="aviso-push-convite" role="status">
        <button type="button" className="aviso-push-fechar" aria-label="Dispensar"
                onClick={() => dispensar("ios_sem_instalar")}>×</button>
        <strong>Instale o app para receber avisos</strong>
        <p>No iPhone, toque em Compartilhar e depois em &ldquo;Adicionar à Tela de Início&rdquo;. Sem isso o iPhone não entrega aviso nenhum.</p>
      </div>
    );
  }

  if (estado === "negado") {
    return (
      <div className="aviso-push-convite" role="status">
        <button type="button" className="aviso-push-fechar" aria-label="Dispensar"
                onClick={() => dispensar("negado")}>×</button>
        <strong>Avisos bloqueados neste aparelho</strong>
        <p>Você vai continuar sem saber de lead novo até abrir o app. Para reativar, entre nas configurações do navegador, procure este site e libere as notificações.</p>
      </div>
    );
  }

  return (
    <div className="aviso-push-convite" role="status">
      <button type="button" className="aviso-push-fechar" aria-label="Dispensar"
              onClick={() => dispensar("pode_pedir")}>×</button>
      <strong><span aria-hidden="true">🔔</span> Receba aviso de lead novo</strong>
      <p>Chega igual mensagem no celular, na hora que o lead cai para você. Quem responde primeiro vende.</p>
      {erro && <p style={{ color: "#b91c1c" }}>{erro}</p>}
      <div className="aviso-push-acoes">
        <button type="button" className="aviso-push-btn" disabled={ocupado} onClick={() => void ligar()}>
          {ocupado ? "Ligando…" : "Ligar avisos"}
        </button>
      </div>
    </div>
  );
}
