import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DarkHaven CRM",
  description: "CRM premium DarkHaven para clientes, vendas, pedidos, financeiro e pós-venda.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? "https://darkhavencrm.com.br"),
  alternates: {
    canonical: "/",
    languages: { "pt-BR": "/" }
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#030405"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
