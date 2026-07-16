import type { Metadata } from "next";
import "./globals.css";
import { SaraWidget } from "./components/SaraWidget";

export const metadata: Metadata = {
  title: "ApêCerto — ERP",
  description: "Sistema operacional imobiliário da ApêCerto.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}<SaraWidget /></body>
    </html>
  );
}
