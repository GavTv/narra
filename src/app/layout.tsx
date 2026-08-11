import type { Metadata, Viewport } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Narra — данные, которые говорят",
  description:
    "AI-дашборд, который превращает таблицы и текстовые отчёты в понятную историю.",
};

export const viewport: Viewport = {
  themeColor: "#f4f3ee",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
