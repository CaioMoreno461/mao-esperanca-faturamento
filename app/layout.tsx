import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mão de Esperança — Gestão Financeira",
  description:
    "Controlo interno de caixa, orçamentos, profissionais e laboratórios da Clínica Mão de Esperança.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-PT">
      <body className="antialiased">{children}</body>
    </html>
  );
}

