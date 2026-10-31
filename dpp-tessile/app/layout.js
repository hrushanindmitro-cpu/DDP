import "./globals.css";
import { Inter } from "next/font/google";
import { ACTIVE_LOCALE, t } from "../lib/i18n";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });

export const metadata = { title: t("app.name"), description: "Digital Product Passport for textiles" };

export default function RootLayout({ children }) {
  return (
    <html lang={ACTIVE_LOCALE}>
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
