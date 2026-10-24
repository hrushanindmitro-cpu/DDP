"use client";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  gs1Link, parseComposition, simulateProof, buildJsonLd,
  saveDpp, loadDraft, saveDraft, normalizeGtin
} from "../lib/dpp";

const card = "rounded-2xl bg-white p-6 shadow-sm border border-gray-100";
const input =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-ink placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";
const cta =
  "w-full rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent/40";
const ghost = "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-ink hover:bg-gray-50";

const FIELDS = [
  { k: "gtin", label: "Product GTIN", ph: "09521100000006", tip: "Es: 09521100000006 - codice EAN", req: true },
  { k: "batch", label: "Batch / Lotto", ph: "LOT-2026-PRATO-01", tip: "Es: LOT-2026-PRATO-01", req: true },
  { k: "composition", label: "Composizione", ph: "80% WO Lana - IT / 20% PL - CN", tip: "Es: 80% WO Lana - IT / 20% PL - CN", req: true },
  { k: "carbon", label: "Carbon Footprint", ph: "2.5 kgCO2e", tip: "Es: 2.5 kgCO2e da cert PEF", req: true },
  { k: "water", label: "Water Footprint", ph: "50L", tip: "Es: 50L" },
  { k: "hazard", label: "Sostanze pericolose", select: true, tip: "Dichiarazione REACH sulle sostanze SVHC" }
];

function Tip({ text }) {
  return (
    <span className="group relative ml-1.5 inline-flex">
      <span tabIndex={0} aria-label={text}
        className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-gray-300 text-[10px] text-muted">?</span>
      <span role="tooltip"
        className="pointer-events-none absolute bottom-6 left-1/2 z-10 hidden w-max max-w-[260px] -translate-x-1/2 rounded-lg bg-ink px-3 py-1.5 text-xs font-normal text-white group-hover:block group-focus-within:block">
        {text}
      </span>
    </span>
  );
}

function validate(d) {
  const e = {};
  if (!/^\d{8,14}$/.test(String(d.gtin || "").replace(/\s/g, ""))) e.gtin = "Inserisci 8-14 cifre";
  if (!d.batch?.trim()) e.batch = "Campo obbligatorio";
  if (!d.composition?.trim() || parseComposition(d.composition).every((c) => c.percent == null))
    e.composition = "Usa il formato: 80% WO Lana - IT / 20% PL - CN";
  if (!d.carbon?.trim()) e.carbon = "Campo obbligatorio";
  return e;
}

function Badge() {
  return <span className="rounded-full bg-[#F59E0B] px-3 py-1 text-xs font-medium text-ink">◐ Anteprima - Demo non ancorata</span>;
}

function Preview({ d, proof }) {
  const comp = parseComposition(d.composition);
  return (
    <div className={card}>
      <div className="mb-4 flex justify-end"><Badge /></div>
      <div className="mb-6 flex h-40 items-center justify-center rounded-xl bg-gray-50 text-sm text-muted">Foto prodotto</div>
      <dl className="mb-6 grid grid-cols-2 gap-4 text-sm">
        <div><dt className="text-muted">GTIN</dt><dd className="font-medium">{normalizeGtin(d.gtin)}</dd></div>
        <div><dt className="text-muted">Lotto</dt><dd className="font-medium">{d.batch}</dd></div>
      </dl>
      <table className="mb-6 w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-muted">
            <th className="py-2 font-normal">Fibra</th><th className="py-2 font-normal">%</th><th className="py-2 text-right font-normal">Origine</th>
          </tr>
        </thead>
        <tbody>
          {comp.map((c, i) => (
            <tr key={i} className="border-b border-gray-50">
              <td className="py-2">{c.fibre}</td><td className="py-2">{c.percent ?? "-"}</td><td className="py-2 text-right">{c.origin || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mb-6 flex gap-3 text-sm">
        <div className="flex-1 rounded-xl bg-gray-50 p-3"><div className="text-lg">🌿</div><div className="text-muted">Carbonio</div><div className="font-medium">{d.carbon}</div></div>
        <div className="flex-1 rounded-xl bg-gray-50 p-3"><div className="text-lg">💧</div><div className="text-muted">Acqua</div><div className="font-medium">{d.water || "-"}</div></div>
      </div>
      {d.hazard && <p className="mb-6 text-sm text-muted">Sostanze pericolose: <span className="text-ink">{d.hazard}</span></p>}
      <div className="rounded-xl border border-gray-100 p-3 text-xs text-muted">
        <div className="font-medium text-ink">Blockchain Proof - Immutable - Polygon</div>
        <div className="mt-1 break-all font-mono">{proof.hash}</div>
        <div className="mt-1">{proof.timestamp}</div>
        <p className="mt-2 text-[11px] text-muted">Questa è una simulazione. L'ancoraggio reale su Polygon sarà attivo al lancio.</p>
      </div>
    </div>
  );
}

export default function Home() {
  const [step, setStep] = useState("form");
  const [d, setD] = useState({ gtin: "", batch: "", composition: "", carbon: "", water: "", hazard: "" });
  const [errors, setErrors] = useState({});
  const [proof, setProof] = useState(null);
  const [copied, setCopied] = useState(false);
  const [urgency, setUrgency] = useState(false);

  useEffect(() => {
    const s = loadDraft(); if (s) setD((p) => ({ ...p, ...s }));
    setUrgency(new URLSearchParams(window.location.search).get("urgency") === "true");
  }, []);
  const set = (k, v) => { const n = { ...d, [k]: v }; setD(n); saveDraft(n); };

  const submit = (ev) => {
    ev.preventDefault();
    const e = validate(d);
    setErrors(e);
    if (Object.keys(e).length) return;
    setProof(simulateProof());
    setStep("preview");
  };

  const link = gs1Link(d.gtin, d.batch);
  const json = proof ? buildJsonLd(d, proof) : null;

  const pay = () => {
    saveDpp({ id: Date.now(), link, data: d, proof, jsonld: json, createdAt: new Date().toISOString() });
    setStep("done");
  };
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(json, null, 2)], { type: "application/ld+json" }));
    a.download = `dpp-${normalizeGtin(d.gtin)}-${d.batch}.jsonld`;
    a.click();
  };

  return (
    <div className="mx-auto max-w-[640px]">
      {urgency && (
        <div className="mb-4 rounded-2xl border border-[#F59E0B] bg-[#F59E0B]/10 px-4 py-3 text-sm text-ink shadow-sm">
          Modalità Urgenza: Risposta garantita in 24h via WhatsApp
        </div>
      )}
      {step === "form" && (
        <form onSubmit={submit} className={`${card} space-y-5`} noValidate>
          <div>
            <h1 className="text-xl font-semibold">Crea un nuovo DPP</h1>
            <p className="mt-1 text-sm text-muted">Compila i dati del prodotto tessile.</p>
          </div>
          {FIELDS.map((f) => (
            <div key={f.k}>
              <label htmlFor={f.k} className="mb-1.5 flex items-center text-sm font-medium">
                {f.label}{f.req && <span className="ml-0.5">*</span>}<Tip text={f.tip} />
              </label>
              {f.select ? (
                <select id={f.k} value={d[f.k]} onChange={(e) => set(f.k, e.target.value)} className={input}>
                  <option value="">Seleziona</option>
                  <option value="REACH compliant - No SVHC >0.1%">REACH compliant - No SVHC &gt;0.1%</option>
                </select>
              ) : (
                <input id={f.k} value={d[f.k]} placeholder={f.ph} onChange={(e) => set(f.k, e.target.value)} className={input} />
              )}
              {errors[f.k] && <p className="mt-1 text-xs text-red-500">{errors[f.k]}</p>}
            </div>
          ))}
          <button type="submit" className={cta}>Anteprima DPP</button>
        </form>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <Preview d={d} proof={proof} />
          <div className={`${card} flex items-center gap-5`}>
            <QRCodeSVG value={link} size={112} level="M" />
            <div className="min-w-0 text-sm">
              <div className="text-muted">Link GS1 Digital Link</div>
              <div className="break-all">{link}</div>
            </div>
          </div>
          <button onClick={pay} className={cta}>Paga e ottieni link GS1 + QR</button>
          <p className="text-center text-xs text-muted">Pagamento simulato in questa demo: nessun addebito.</p>
          <button onClick={() => setStep("form")} className={ghost}>Modifica dati</button>
        </div>
      )}

      {step === "done" && (
        <div className="space-y-4">
          <div className={`${card} space-y-5 text-center`}>
            <div className="flex justify-center"><Badge /></div>
            <div className="flex justify-center"><QRCodeSVG value={link} size={176} level="M" /></div>
            <div className="break-all rounded-xl bg-gray-50 p-3 text-left text-xs">{link}</div>
            <div className="flex gap-3">
              <button onClick={copy} className={cta}>{copied ? "Copiato" : "Copia link"}</button>
              <button onClick={download} className={ghost}>Scarica JSON-LD</button>
            </div>
            <span className="group relative block">
              <button type="button" disabled className="w-full cursor-not-allowed rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-400">Verifica su Polygon</button>
              <span role="tooltip" className="pointer-events-none absolute bottom-14 left-1/2 hidden -translate-x-1/2 rounded-lg bg-ink px-3 py-1.5 text-xs text-white group-hover:block">Disponibile al lancio</span>
            </span>
          </div>
          <details className={card}>
            <summary className="cursor-pointer text-sm font-medium">JSON-LD</summary>
            <pre className="mt-4 overflow-x-auto text-xs text-muted">{JSON.stringify(json, null, 2)}</pre>
          </details>
          <button onClick={() => { setProof(null); setStep("form"); }} className={ghost}>Crea un altro DPP</button>
        </div>
      )}
    </div>
  );
}
