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
import "./styles/tela-corretor.css";
import "./styles/tela-crm.css";
import "./styles/tela-avisos.css";
import "./styles/tela-agenda.css";
import "./styles/tela-agenda-mes.css";
import "./styles/telas-prototipo.css";
/* Correções vindas de uso real: cabeçalho em dobro, WhatsApp verde, ícone do
   CRM e tamanho de fonte. Depois de todas para vencer sem seletor extra. */
import "./styles/correcoes-celular.css";
/* A ÚLTIMA: a ação de gestão é a exceção da regra do verde, então precisa
   vir depois de quem pinta de verde. */
import "./styles/tela-gestao-card.css";
/* Depois de tela-gestao-card sem quebrar a regra dela: esta folha só trata de
   layout e rolagem das colunas de kanban — não toca em cor nem em token. */
import "./styles/esteira-rolagem.css";
/* Menu de ações por lançamento no fluxo de caixa. Isolado pelo mesmo motivo:
   globals.css tem 665 KB e um diff pequeno é reversível. */
import "./styles/fluxo-caixa-acoes.css";
/* Alvo de toque do × que dispensa o aviso de notificação. Fora da folha de
   identidade porque lá a regra é: nada que dependa de layout. */
import "./styles/aviso-push-dispensar.css";
/* Os indicadores do Meu Dia viraram botão de filtro; isto zera a aparência de
   botão. Cor e grade continuam em FUNIL2_CSS. */
import "./styles/meu-dia-filtros.css";
/* O card do Pescado não tem prazo: o badge precisa ser cinza, não o verde de
   "no prazo". A regra mora no banco; aqui é só a leitura visual dela. */
import "./styles/pescado-sem-prazo.css";
/* Explicador de automações: o painel que conta o fluxo passo a passo. Só usa
   tokens do :root, então segue a marca sem duplicar cor. */
import "./styles/tela-explicador.css";
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
