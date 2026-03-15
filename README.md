# thai-postal-code

> Resolve Thai postal codes into province, district, and subdistricts — with bilingual (Thai + English) names and coordinates.

[![CI](https://github.com/YOUR_USERNAME/thai-postal-code/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/thai-postal-code/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/thai-postal-code.svg)](https://www.npmjs.com/package/thai-postal-code)
[![JSR](https://jsr.io/badges/@YOUR_SCOPE/thai-postal-code)](https://jsr.io/@YOUR_SCOPE/thai-postal-code)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## What is this?

Thai postal codes are 5-digit numbers. Each code maps to exactly **one district** (อำเภอ / เขต) inside a province (จังหวัด), but may cover **multiple sub-districts** (ตำบล / แขวง).

This library solves the standard Thai address form problem:

1. User enters a postal code → **province and district fill automatically**
2. A subdistrict dropdown is **populated with the correct choices**

All names come in both Thai and English. Coordinates (lat/lng) are included where available. Everything runs **synchronously** — data is indexed at module load, so every lookup is an O(1) hash map read with no async overhead.

Works in **Node.js, Bun, Deno, and the browser** with no runtime dependencies.

---

## Install

```bash
# npm
npm install thai-postal-code

# Bun
bun add thai-postal-code

# JSR (Deno / Bun / Node)
npx jsr add @YOUR_SCOPE/thai-postal-code
deno add jsr:@YOUR_SCOPE/thai-postal-code

# CDN (browser, no bundler)
import { autofillByPostalCode } from "https://esm.sh/thai-postal-code";
```

---

## Quick start

```ts
import { autofillByPostalCode } from "thai-postal-code";

const result = autofillByPostalCode("10330");

result.provinceNameTh  // "กรุงเทพมหานคร"
result.provinceNameEn  // "Bangkok"
result.districtNameTh  // "ปทุมวัน"
result.districtNameEn  // "Pathum Wan"
result.subdistricts
// [
//   { subdistrictNameTh: "ลุมพินี",  subdistrictNameEn: "Lumphini",  subdistrictCode: 103007 },
//   { subdistrictNameTh: "วังใหม่",   subdistrictNameEn: "Wang Mai",   subdistrictCode: 103008 },
//   { subdistrictNameTh: "รองเมือง", subdistrictNameEn: "Rong Mueang", subdistrictCode: 103006 },
// ]
```

Note: all functions are **synchronous**. No `await` needed.

---

## Runtime support

| Runtime | Support |
|---------|---------|
| Node.js ≥ 18 | ✓ |
| Bun ≥ 1.0 | ✓ |
| Deno (via JSR) | ✓ |
| Browser (ESM) | ✓ |
| TypeScript | ✓ Full types exported |

---

## API

### `lookupByPostalCode(postalCode, options?)`

Full lookup — returns province, district, subdistricts, and coordinates.

Uses the pre-built postal index. O(1) hash map lookup.

```ts
import { lookupByPostalCode } from "thai-postal-code";

const result = lookupByPostalCode("50000");
// {
//   postalCode:     "50000",
//   provinceNameTh: "เชียงใหม่",
//   provinceNameEn: "Chiang Mai",
//   districtNameTh: "เมืองเชียงใหม่",
//   districtNameEn: "Mueang Chiang Mai",
//   subdistricts:   [{ subdistrictNameTh: "ช้างคลาน", subdistrictNameEn: "Chang Khlan", subdistrictCode: 500103 }, ...],
//   lat:            18.7883439,
//   lng:            98.9929882
// }
```

Throws by default for unknown or invalid input. Pass `{ silent: true }` to return `null` instead.

---

### `autofillByPostalCode(postalCode, options?)`

Same as `lookupByPostalCode` but omits `lat` and `lng`. Use when you only need to fill address fields.

```ts
import { autofillByPostalCode } from "thai-postal-code";

const fill = autofillByPostalCode("76000", { silent: true });
if (fill) {
  fill.provinceNameTh  // "เพชรบุรี"
  fill.districtNameTh  // "เมืองเพชรบุรี"
  fill.subdistricts    // SubdistrictEntry[]
}
```

---

### `getSubdistrictsByPostalCode(postalCode)`

Returns only the subdistrict list. Never throws — returns `[]` for unknown codes.

```ts
import { getSubdistrictsByPostalCode } from "thai-postal-code";

getSubdistrictsByPostalCode("10330")
// [
//   { subdistrictNameTh: "ลุมพินี", subdistrictNameEn: "Lumphini", subdistrictCode: 103007 },
//   ...
// ]
```

---

### `searchAddress(query, limit?)`

Substring search across Thai and English names for province, district, and subdistrict, and the postal code itself. Case-insensitive for English fields.

Default limit: 20. Returns `ThaiSearchResult[]` which includes `lat` and `lng`.

```ts
import { searchAddress } from "thai-postal-code";

searchAddress("สีลม")     // Thai name match
searchAddress("Silom")    // English match (case-insensitive)
searchAddress("10500")    // postal code match
searchAddress("Silom", 5) // limit to 5 results
```

---

### `listProvinces()`

All 77 Thai provinces, sorted by Thai name.

```ts
import { listProvinces } from "thai-postal-code";

listProvinces()
// [
//   { nameTh: "กระบี่",         nameEn: "Krabi" },
//   { nameTh: "กรุงเทพมหานคร", nameEn: "Bangkok" },
//   ...
// ]
```

---

### `listDistrictsByProvince(provinceNameTh)`

All districts for a province, sorted by Thai name. Each entry includes the district's postal code.

```ts
import { listDistrictsByProvince } from "thai-postal-code";

listDistrictsByProvince("เชียงใหม่")
// [
//   { nameTh: "กัลยาณิวัฒนา", nameEn: "Galyani Vadhana", postalCode: "58130" },
//   { nameTh: "จอมทอง",        nameEn: "Chom Thong",       postalCode: "50160" },
//   ...
// ]
```

---

### `listAllPostalCodes()`

All postal codes in the dataset, sorted ascending. Sourced from the postal index keys.

```ts
import { listAllPostalCodes } from "thai-postal-code";

listAllPostalCodes()
// ["10100", "10110", "10120", ...]
```

---

## LookupOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `silent` | `boolean` | `false` | Return `null` instead of throwing for unknown or invalid input |

---

## TypeScript types

```ts
import type {
  RawThaiRecord,      // raw bundled row (10 fields + lat/lng)
  SubdistrictEntry,   // { subdistrictNameTh, subdistrictNameEn, subdistrictCode }
  ThaiAddressResult,  // full result with subdistricts + lat/lng
  ThaiAutofillResult, // result without lat/lng
  ThaiSearchResult,   // flat row from searchAddress() with lat/lng
  LookupOptions,      // { silent?: boolean }
} from "thai-postal-code";
```

---

## Framework examples

### React

```tsx
import { useState } from "react";
import { autofillByPostalCode, type SubdistrictEntry } from "thai-postal-code";

export function AddressForm() {
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [subdistricts, setSubdistricts] = useState<SubdistrictEntry[]>([]);
  const [selectedSub, setSelectedSub] = useState("");

  function handlePostalInput(code: string) {
    if (code.length !== 5) return;
    const result = autofillByPostalCode(code, { silent: true });
    if (!result) return;
    setProvince(result.provinceNameTh);
    setDistrict(result.districtNameTh);
    setSubdistricts(result.subdistricts);
    setSelectedSub(result.subdistricts[0]?.subdistrictNameTh ?? "");
  }

  return (
    <div>
      <input
        placeholder="รหัสไปรษณีย์"
        maxLength={5}
        onChange={(e) => handlePostalInput(e.target.value)}
      />
      <input value={province} readOnly placeholder="จังหวัด" />
      <input value={district} readOnly placeholder="อำเภอ / เขต" />
      <select
        value={selectedSub}
        onChange={(e) => setSelectedSub(e.target.value)}
      >
        {subdistricts.map((s) => (
          <option key={s.subdistrictCode} value={s.subdistrictNameTh}>
            {s.subdistrictNameTh}
          </option>
        ))}
      </select>
    </div>
  );
}
```

### Vue 3

```vue
<script setup lang="ts">
import { ref } from "vue";
import { autofillByPostalCode, type SubdistrictEntry } from "thai-postal-code";

const province = ref("");
const district = ref("");
const subdistricts = ref<SubdistrictEntry[]>([]);

function onPostalInput(code: string) {
  if (code.length !== 5) return;
  const result = autofillByPostalCode(code, { silent: true });
  if (!result) return;
  province.value = result.provinceNameTh;
  district.value = result.districtNameTh;
  subdistricts.value = result.subdistricts;
}
</script>
```

---

## Data sources

### Primary — address data

**thailand-geography-json** by [thailand-geography-data](https://github.com/thailand-geography-data)
https://github.com/thailand-geography-data/thailand-geography-json

Provides all 77 provinces, 928 districts, and 7,436 sub-districts with Thai and English names, joined by postal code across three files (`provinces.json`, `districts.json`, `subdistricts.json`).

### Secondary — coordinates

**Thai-zip-code-latitude-and-longitude** by [@rathpanyowat](https://github.com/rathpanyowat)
https://github.com/rathpanyowat/Thai-zip-code-latitude-and-longitude

Provides a representative `lat`/`lng` per postal code. Merged at bundle time by postal code. Codes absent from this dataset have `lat: null, lng: null`.

---

## Special thanks

Thank you to **[thailand-geography-data](https://github.com/thailand-geography-data)** for maintaining a comprehensive, bilingual, and actively updated dataset of Thai geographical data, and to **[@rathpanyowat](https://github.com/rathpanyowat)** for the postal code coordinate dataset. This library is built entirely on their work.

---

## Contributing

```bash
bun install
bun run data:pipeline   # fetch all sources, join, validate
bun run build:check:all # type-check src/ and scripts/
bun test
bun run build
```

Do not commit `src/data/thai-postal-code.data.ts` — it is auto-generated and gitignored.

---

## License

[MIT](./LICENSE)