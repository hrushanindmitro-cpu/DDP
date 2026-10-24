import "./globals.css";
import { Inter } from "next/font/google";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = { title: "DPP Tessile", description: "Passaporto Digitale di Prodotto per il tessile" };

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body className={`${inter.variable} font-sans antialiased`}>
        <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
          <Link href="/" className="text-sm font-semibold">DPP Tessile</Link>
          <nav className="flex gap-6 text-sm text-muted">
            <Link href="/" className="hover:text-ink">Crea DPP</Link>
            <Link href="/pricing" className="hover:text-ink">Prezzi</Link>
          </nav>
        </header>
        <main className="px-6 pb-24">{children}</main>
      </body>
    </html>
  );
}
