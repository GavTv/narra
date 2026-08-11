import type { Metadata, Viewport } from "next";
import { Onest, Unbounded } from "next/font/google";

import "@/app/globals.css";

const sans = Onest({
  subsets: ["cyrillic", "latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const display = Unbounded({
  subsets: ["cyrillic", "latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Narra — данные, которые говорят",
  description:
    "AI-дашборд, который превращает таблицы и текстовые отчёты в понятную историю.",
};

export const viewport: Viewport = {
  themeColor: "#e8eef4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
