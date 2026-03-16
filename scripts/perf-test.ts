/**
 * scripts/perf-test.ts
 *
 * Performance benchmark for the core lookup functions.
 * Measures throughput and latency for the most performance-sensitive paths.
 *
 * Run via: bun run perf
 */

import {
  lookupByPostalCode,
  autofillByPostalCode,
  getSubdistrictsByPostalCode,
  searchAddress,
  listProvinces,
  listAllPostalCodes,
} from "../src/index";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bench(label: string, iterations: number, fn: () => void): void {
  // Warmup — ensure JIT has compiled the hot path
  for (let i = 0; i < 100; i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;

  const opsPerSec = Math.round((iterations / elapsed) * 1000).toLocaleString();
  const avgUs = ((elapsed / iterations) * 1000).toFixed(2);

  console.log(`  ${label.padEnd(42)} ${opsPerSec.padStart(12)} ops/sec   avg ${avgUs} μs`);
}

function section(title: string): void {
  console.log(`\n${title}`);
  console.log("─".repeat(72));
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Sample postal codes spread across the dataset
const POSTAL_CODES = [
  "10330", // Bangkok — Pathum Wan
  "50000", // Chiang Mai — Mueang
  "76000", // Phetchaburi
  "83000", // Phuket
  "40000", // Khon Kaen
  "30000", // Nakhon Ratchasima
  "90000", // Songkhla
  "20000", // Chon Buri
];

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log("thai-postal-code — performance benchmark");
console.log(`${"=".repeat(72)}`);
console.log(`  Date       : ${new Date().toISOString()}`);
console.log(`  Runtime    : Bun ${Bun.version}`);
console.log(`  Iterations : see per-bench`);

section("lookupByPostalCode  (O(1) postal index)");
for (const code of POSTAL_CODES) {
  bench(`lookup("${code}")`, 100_000, () => {
    lookupByPostalCode(code, { silent: true });
  });
}

section("autofillByPostalCode  (O(1) postal index, no lat/lng)");
bench(`autofill("10330")`, 100_000, () => {
  autofillByPostalCode("10330", { silent: true });
});
bench(`autofill("50000")`, 100_000, () => {
  autofillByPostalCode("50000", { silent: true });
});

section("getSubdistrictsByPostalCode  (O(1), never throws)");
bench(`getSubdistricts("10330")`, 100_000, () => {
  getSubdistrictsByPostalCode("10330");
});
bench(`getSubdistricts("00000") — miss`, 100_000, () => {
  getSubdistrictsByPostalCode("00000");
});

section("searchAddress  (linear scan of SEARCH_ROWS)");
bench(`search("สีลม")        Thai match`, 10_000, () => {
  searchAddress("สีลม");
});
bench(`search("Silom")       English match`, 10_000, () => {
  searchAddress("Si lom");
});
bench(`search("10500")       postal code match`, 10_000, () => {
  searchAddress("10500");
});
bench(`search("กรุงเทพ")     early hit, large result`, 10_000, () => {
  searchAddress("กรุงเทพ");
});
bench(`search("zzznomatch")  no result`, 10_000, () => {
  searchAddress("zzznomatch");
});

section("listProvinces / listAllPostalCodes  (sorted iteration)");
bench(`listProvinces()`, 10_000, () => {
  listProvinces();
});
bench(`listAllPostalCodes()`, 10_000, () => {
  listAllPostalCodes();
});

section("cold start simulation  (first call with distinct codes)");
{
  const allCodes = listAllPostalCodes();
  const sample = allCodes.filter((_, i) => i % 10 === 0); // every 10th code
  const start = performance.now();
  let hits = 0;
  for (const code of sample) {
    const r = lookupByPostalCode(code, { silent: true });
    if (r !== null) hits++;
  }
  const elapsed = performance.now() - start;
  console.log(`  ${sample.length} distinct lookups in ${elapsed.toFixed(2)} ms  (${hits} hits)`);
}

console.log(`\n${"=".repeat(72)}\n`);