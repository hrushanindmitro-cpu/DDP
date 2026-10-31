// Ukrainian business identifiers. Only the format and check digit are verified here;
// existence in the public registry is a separate step (see docs/BACKLOG.md).

// ЄДРПОУ: 8 digits, check digit is the last one.
export function isValidEdrpou(value) {
  if (!/^\d{8}$/.test(value)) return false;
  const d = value.split("").map(Number);
  const n = Number(value);
  const w = n > 30000000 && n < 60000000 ? [7, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7];
  const sum = (weights) => d.slice(0, 7).reduce((acc, x, i) => acc + x * weights[i], 0) % 11;
  let check = sum(w);
  if (check === 10) {
    check = sum(w[0] === 1 ? w.map((x) => x + 2) : [9, 3, 4, 5, 6, 7, 8]);
    if (check === 10) check = 0;
  }
  return check === d[7];
}

export const normalizeRegistryId = (v) => String(v ?? "").replace(/[\s-]/g, "");
