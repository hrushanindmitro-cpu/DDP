export const BASE = "https://dpp.tuodominio.com";

export function normalizeGtin(g) {
  return String(g || "").replace(/\s/g, "").padStart(14, "0");
}

export function gs1Link(gtin, batch) {
  return `${BASE}/01/${normalizeGtin(gtin)}/10/${encodeURIComponent(batch)}?linkType=dpp`;
}

// "80% WO Lana - IT / 20% PL - CN" -> [{percent, fibre, origin}]
export function parseComposition(text) {
  return String(text || "")
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = p.match(/^(\d+(?:[.,]\d+)?)\s*%\s*(.+?)(?:\s*-\s*([A-Za-z]{2}))?$/);
      return m
        ? { percent: parseFloat(m[1].replace(",", ".")), fibre: m[2].trim(), origin: (m[3] || "").toUpperCase() }
        : { percent: null, fibre: p, origin: "" };
    });
}

// DEMO proof: NOT written to any chain. Swap this for real anchoring later
// (return isDemo: false and a real tx hash).
export function simulateProof() {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  const randomHex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return {
    hash: "DEMO-" + randomHex + "-" + Date.now(),
    timestamp: new Date().toISOString(),
    network: "Polygon",
    simulated: true,
    isDemo: true
  };
}

export function buildJsonLd(d, proof) {
  const link = gs1Link(d.gtin, d.batch);
  const carbon = parseFloat(String(d.carbon).replace(",", "."));
  const water = parseFloat(String(d.water).replace(",", "."));
  return {
    "@context": ["https://schema.org", "https://ref.gs1.org/voc/"],
    "@type": "Product",
    "@id": link,
    gtin: normalizeGtin(d.gtin),
    productID: `lot:${d.batch}`,
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "fibreComposition",
        value: parseComposition(d.composition).map((c) => ({
          percentage: c.percent, fibre: c.fibre, countryOfOrigin: c.origin
        }))
      },
      {
        "@type": "PropertyValue",
        name: "carbonFootprint",
        value: isNaN(carbon) ? d.carbon : carbon,
        unitText: "kgCO2e"
      },
      ...(d.water ? [{ "@type": "PropertyValue", name: "waterFootprint", value: isNaN(water) ? d.water : water, unitText: "L" }] : []),
      ...(d.hazard ? [{ "@type": "PropertyValue", name: "substancesOfConcern", value: d.hazard }] : [])
    ],
    conformsTo: "https://eur-lex.europa.eu/eli/reg/2024/1781/oj",
    proof: {
      "@type": "DataIntegrityProof",
      network: proof.network,
      hash: proof.hash,
      created: proof.timestamp,
      isDemo: proof.isDemo === true
    }
  };
}

export function saveDpp(rec) {
  try {
    const list = JSON.parse(localStorage.getItem("dpp:list") || "[]");
    list.unshift(rec);
    localStorage.setItem("dpp:list", JSON.stringify(list));
  } catch {}
}

export function loadDraft() {
  try { return JSON.parse(localStorage.getItem("dpp:draft") || "null"); } catch { return null; }
}
export function saveDraft(d) {
  try { localStorage.setItem("dpp:draft", JSON.stringify(d)); } catch {}
}
