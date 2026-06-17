import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DarkHaven CRM",
  description: "CRM premium DarkHaven para clientes, vendas, pedidos, financeiro e pós-venda."
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
