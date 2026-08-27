import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./styles/app-mobile.css";
/* POR ÚLTIMO, sempre. Esta folha remapeia --orange, --ink, --line e --muted
   para os tokens da marca; carregada antes, o CSS antigo a sobrescreveria. */
import "./styles/apecerto-identidade.css";
/* Depois da identidade: usam os tokens dela. Tudo dentro de max-width — o
   desktop não é tocado por nenhuma delas. */
/* Ficha da venda: modal em abas + agenda de repasse. Depois da identidade
   porque usa os tokens da marca. */
import "./styles/venda-ficha.css";
/* Importar extrato: seção dentro do Fluxo de caixa. Autocontida sob
   .extrato-painel, pelos mesmos motivos da folha acima. */
import "./styles/extrato-import.css";
import "./styles/tela-avisos.css";
/* Depois de tela-gestao-card sem quebrar a regra dela: esta folha só trata de
   layout e rolagem das colunas de kanban — não toca em cor nem em token. */
import "./styles/esteira-rolagem.css";
/* Menu de ações por lançamento no fluxo de caixa. Isolado pelo mesmo motivo:
   globals.css tem 665 KB e um diff pequeno é reversível. */
import "./styles/fluxo-caixa-acoes.css";
/* Explicador de automações: o painel que conta o fluxo passo a passo. Só usa
   tokens do :root, então segue a marca sem duplicar cor. */
import "./styles/tela-explicador.css";
/* Botao de tour virtual na galeria de Produtos. */
import "./styles/tela-produtos-tour.css";
import "./styles/tela-suporte-financiamento.css";
/* DESENHO VIGENTE DO ERP (desktop) — padrão apêcerto.

   UMA camada de desenho, dividida por domínio do mesmo jeito que o resto deste
   arquivo já divide (venda-ficha, extrato-import, fluxo-caixa-acoes…):

     1. redesign-apecerto.css ................. shell e Início
     2. ...-produtos-financeiro.css ........... Produtos, ficha da venda, Financeiro
     3. ...-financeiro-abas.css ............... Marketing, Indicações, Taxas, Metas, Meus ganhos
     4. ...-inicio.css ........................ Início: topo, seções, ranking, estados
     5. ...-esteira.css ....................... Esteira de Vendas 3.0 (pós-fechamento)
     6. ...-catalogo.css ...................... card do catálogo de Produtos
     7. ...-abordagens.css .................... Abordagens: biblioteca, cartões, editor, prévia
     8. ...-abordagens-rodape.css ............. Abordagens: as regras de 3 classes do globals
     9. ...-abordagens-icones.css ............. Abordagens: glifos e emoji viram Lucide por máscara
    10. ...-menu.css ......................... Menu lateral: ordem aprovada (order) + ícones Lucide
    11. ...-disparos.css ..................... Disparos: público, mensagem, cadência, revisão, recentes
    12. ...-calendario.css ................... Calendário: Dia/Semana/Mês/Lista, resumo, modais

   Elas substituem por cascata os valores visuais que globals.css definia para
   os MESMOS seletores —
   não são tema opcional nem segunda pele: são o visual do produto.

   DUAS ARMADILHAS JÁ PAGAS, anotadas para não repetir:

   (a) ORDEM NÃO BASTA quando a folha antiga escreve o mesmo alvo com mais classes
       (ex.: .approach-list .approach-card > footer .approach-edit-btn). Por isso
       cada folha nasce prefixada pela classe raiz da tela.

   Ficam ANTES das folhas do aplicativo no celular, logo abaixo: o app do
   corretor continua exatamente como está. */
import "./styles/redesign-apecerto.css";
import "./styles/redesign-apecerto-produtos-financeiro.css";
import "./styles/produtos-v3.css";
import "./styles/produtos-v3-detail.css";
import "./styles/redesign-apecerto-financeiro-abas.css";
import "./styles/redesign-apecerto-inicio.css";
import "./styles/redesign-apecerto-esteira.css";
import "./styles/redesign-apecerto-catalogo.css";
import "./styles/redesign-apecerto-abordagens.css";
import "./styles/redesign-apecerto-abordagens-rodape.css";
import "./styles/redesign-apecerto-abordagens-icones.css";
import "./styles/redesign-apecerto-menu.css";
import "./styles/tracking-360.css";
import "./styles/central-comando.css";
import "./styles/central-comando-prototype.css";
import "./styles/redesign-apecerto-disparos.css";
import "./styles/redesign-apecerto-calendario.css";
/* CRM/Funil 2: folha canônica única e final. Estrutura, identidade e
   responsividade do módulo vivem somente nela; nenhuma folha posterior toca
   nas classes f2-* do desktop. */
import "./styles/funil-2.css";
/* CRM V3: rota paralela e local. A folha é totalmente isolada sob .crm-v3;
   não altera o Funil 2.0 canônico nem qualquer outra tela do ERP. */
import "./styles/funil-2-v3.css";
/* INTERFACE DO APLICATIVO NO CELULAR — versão aprovada.
   Não é correção da folha antiga: o markup do Meu Dia e do CRM usa classes
   próprias (.ape-*), então esta folha é a única que os desenha. As regras
   .f2m-* de app-mobile.css deixaram de casar com essas telas. */
import "./styles/app-mobile-aprovado.css";
/* Telas do gestor no celular (folha "Mais" e Minha Equipe). Depois da folha
   aprovada porque reusa os mesmos valores e completa o que faltava dela. */
import "./styles/app-mobile-gestor.css";
import { RegistroPwa } from "./components/RegistroPwa";

export const metadata: Metadata = {
  title: "ApêCerto — ERP",
  description: "Sistema operacional imobiliário da ApêCerto.",
  manifest: "/manifest.webmanifest",
  applicationName: "ApêCerto",
  appleWebApp: {
    capable: true,
    title: "ApêCerto",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icone-192-v6.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icone-512-v6.png", sizes: "512x512", type: "image/png" },
    ],
    /* Nome fisico novo: o iOS conserva o apple-touch-icon da primeira
       instalacao mesmo quando so a query string muda. */
    apple: [{ url: "/icons/apple-touch-icon-v6.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",

  /* TRAVA DE ZOOM — comportamento de aplicativo, não de site.
     O corretor usa isto com uma mão, andando. Zoom por pinça e duplo toque
     fazia a tela sair do lugar sozinha, e ele tinha que reenquadrar antes de
     conseguir tocar em qualquer coisa.

     CONTRAPARTIDA, assumida: isto remove a capacidade de ampliar a tela, que é
     recurso de acessibilidade. Só é aceitável porque (a) o app foi desenhado
     com fonte de 14–17px e alvos de 44–52px, e (b) o ERP completo continua
     acessível pelo navegador, sem esta trava. */
  maximumScale: 1,
  userScalable: false,

  /* Laranja oficial da marca (#FF7000). É a cor da barra de status no Android
     com o app instalado — a primeira coisa que o corretor vê. */
  themeColor: "#FF7000",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <RegistroPwa />
      </body>
    </html>
  );
}
