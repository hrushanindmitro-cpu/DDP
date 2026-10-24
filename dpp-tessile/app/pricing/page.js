import Link from "next/link";

const plans = [
  { name: "Starter", price: "€49", unit: "/mese", features: ["50 DPP/mese", "1 utente", "QR + Blockchain", "Storage 10 anni"], cta: "Inizia ora - Nessuna carta", href: "/" },
  { name: "Pro", price: "€149", unit: "/mese", popular: true, features: ["500 DPP/mese", "3 utenti", "API", "Export dogana JSON-LD"], cta: "Inizia ora - Nessuna carta", href: "/" },
  { name: "Urgenza", price: "€390", unit: "una tantum", features: ["1 DPP in 24h", "Verifica inclusa", "Per camion in dogana"], cta: "Richiedi Urgenza 24h", href: "/?urgency=true" }
];

export const metadata = { title: "Prezzi - DPP Tessile" };

export default function Pricing() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-10 text-center text-xl font-semibold">Prezzi</h1>
      <div className="grid gap-5 md:grid-cols-3">
        {plans.map((p) => (
          <div key={p.name} className="flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-6 items-center justify-between">
              <span className="text-sm font-medium">{p.name}</span>
              {p.popular && <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs text-white">Popolare</span>}
            </div>
            <div className="mb-6"><span className="text-3xl font-semibold">{p.price}</span><span className="ml-1 text-sm text-muted">{p.unit}</span></div>
            <ul className="mb-8 flex-1 space-y-2 text-sm text-muted">
              {p.features.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <Link href={p.href} className="rounded-xl bg-accent px-4 py-3 text-center text-sm font-medium text-white hover:opacity-90">{p.cta}</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
