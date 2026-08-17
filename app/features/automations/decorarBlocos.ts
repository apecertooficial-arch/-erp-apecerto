/* TÍTULO AMIGÁVEL POR BLOCO no canvas do construtor.
 *
 * POR QUE ASSIM, E NÃO DENTRO DO RUNTIME
 * O jeito "certo de manual" seria alterar o renderNodes do
 * automationBuilderRuntime.js. Não fiz: são 160 KB que eu teria de reemitir
 * inteiros pela API do GitHub (não há patch parcial), e um único caractere
 * perdido nesse reenvio para o MOTOR que roda a operação. O risco não se paga
 * por um rótulo de tela.
 *
 * Então o runtime segue sem uma linha alterada e este módulo DECORA o DOM que
 * ele desenha: número de ordem, eyebrow com o tipo do bloco e o título em cima.
 * Zero efeito em execução — se este arquivo falhar, o construtor continua
 * funcionando como hoje, com o tipo do bloco no lugar do título.
 *
 * ONDE O TÍTULO MORA
 * Coluna automacoes.titulos (jsonb, { "<blocoId>": "Lead novo entra" }), FORA de
 * mapa: o compile() do construtor reconstrói mapa.editor.blocks a cada
 * salvamento e apagaria um campo que ele não conhece.
 *
 * BLOCO SEM TÍTULO não muda nada: mostra o tipo ("Início", "Espera") como hoje,
 * sem eyebrow.
 */

export type MapaTitulos = Record<string, string>;

const MARCA = "apnDecorado";

function ordenar(nos: HTMLElement[]): HTMLElement[] {
  return nos.slice().sort((a, b) => {
    const ax = parseFloat(a.style.left || "0"), bx = parseFloat(b.style.left || "0");
    const ay = parseFloat(a.style.top || "0"), by = parseFloat(b.style.top || "0");
    return ax - bx || ay - by;
  });
}

/* Decora e mantém decorado: o runtime recria os cartões a cada mudança
   (renderNodes limpa e reconstrói), então um MutationObserver reaplica. Devolve a
   função de desligar. */
export function decorarBlocos(
  host: HTMLElement,
  obterTitulos: () => MapaTitulos,
  renomear: (blocoId: string, atual: string) => void,
): () => void {
  let agendado = 0;

  const aplicar = () => {
    agendado = 0;
    const titulos = obterTitulos();
    const nos = ordenar([...host.querySelectorAll<HTMLElement>(".node[data-id]")]);
    nos.forEach((no, i) => {
      const id = no.dataset.id || "";
      const cab = no.querySelector<HTMLElement>(".hd");
      const ttl = cab?.querySelector<HTMLElement>(".ttl");
      if (!cab || !ttl) return;

      const tipo = ttl.dataset.apnTipo || ttl.textContent?.trim() || "Bloco";
      ttl.dataset.apnTipo = tipo;
      const titulo = (titulos[id] || "").trim();

      /* número de ordem — esquerda para a direita, como o fluxo corre */
      let num = cab.querySelector<HTMLElement>(".apn-num");
      if (!num) {
        num = document.createElement("span");
        num.className = "apn-num";
        cab.appendChild(num);
      }
      num.textContent = String(i + 1).padStart(2, "0");

      /* eyebrow com o tipo, só quando existe título próprio para ficar acima dele */
      let eyebrow = ttl.previousElementSibling as HTMLElement | null;
      if (!eyebrow || !eyebrow.classList.contains("apn-node-tipo")) {
        eyebrow = document.createElement("span");
        eyebrow.className = "apn-node-tipo";
        ttl.parentElement?.insertBefore(eyebrow, ttl);
      }
      eyebrow.textContent = tipo;
      eyebrow.style.display = titulo ? "block" : "none";

      ttl.textContent = titulo || tipo;
      ttl.classList.toggle("apn-tem-titulo", !!titulo);

      /* renomear — uma vez por cartão */
      if (no.dataset[MARCA] !== "1") {
        no.dataset[MARCA] = "1";
        const lapis = document.createElement("button");
        lapis.type = "button";
        lapis.className = "apn-node-rename";
        lapis.title = "Dar um nome a este bloco";
        lapis.setAttribute("aria-label", "Dar um nome a este bloco");
        lapis.innerHTML =
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
        lapis.addEventListener("mousedown", (e) => e.stopPropagation());
        lapis.addEventListener("click", (e) => {
          e.stopPropagation();
          renomear(id, (obterTitulos()[id] || "").trim());
        });
        cab.appendChild(lapis);
      }
    });
  };

  const agendar = () => {
    if (agendado) return;
    agendado = requestAnimationFrame(aplicar);
  };

  const obs = new MutationObserver(agendar);
  obs.observe(host, { childList: true, subtree: true });
  agendar();

  return () => { obs.disconnect(); if (agendado) cancelAnimationFrame(agendado); };
}
