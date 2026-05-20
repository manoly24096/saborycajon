import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERP Gastronómico | Buro",
  description: "Sistema integral de gestión para restaurante",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
