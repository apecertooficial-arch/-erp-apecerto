import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./styles/app-mobile.css";
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
  themeColor: "#ff6500",
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
