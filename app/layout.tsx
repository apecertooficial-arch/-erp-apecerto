import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./styles/app-mobile.css";
/* POR ÚLTIMO, sempre. Esta folha remapeia --orange, --ink, --line e --muted
   para os tokens da marca; carregada antes, o CSS antigo a sobrescreveria. */
import "./styles/apecerto-identidade.css";
/* Depois da identidade: usam os tokens dela. Tudo dentro de max-width — o
   desktop não é tocado por nenhuma delas. */
import "./styles/tela-corretor.css";
import "./styles/tela-crm.css";
import "./styles/tela-avisos.css";
import "./styles/tela-agenda.css";
import "./styles/telas-prototipo.css";
/* A ÚLTIMA de todas. Corrige o que só apareceu no aparelho de verdade:
   cabeçalho em dobro, cor do botão do WhatsApp e o ícone do CRM na barra.
   Precisa vir depois de todas para vencer sem seletor mais específico. */
import "./styles/correcoes-celular.css";
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
      { url: "/icons/icone-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icone-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  /* Laranja oficial da marca (#FF7000). Era #ff6500, que não existe na
     paleta. É a cor da barra de status no Android com o app instalado — a
     primeira coisa que o corretor vê, antes de qualquer tela carregar. */
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
