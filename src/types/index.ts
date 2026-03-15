/**
 * Raw record as stored in the bundled data.
 * Sourced from thailand-geography-data/thailand-geography-json (primary)
 * enriched with lat/lng from rathpanyowat/Thai-zip-code-latitude-and-longitude.
 */
export interface RawThaiRecord {
  /** 5-digit postal code string, e.g. "10200" */
  postalCode: string;
  /** Province code (2-digit), e.g. 10 */
  provinceCode: number;
  /** Province name in Thai (จังหวัด) */
  provinceNameTh: string;
  /** Province name in English */
  provinceNameEn: string;
  /** District code (4-digit), e.g. 1001 */
  districtCode: number;
  /** District name in Thai (อำเภอ / เขต) */
  districtNameTh: string;
  /** District name in English */
  districtNameEn: string;
  /** Sub-district code (6-digit), e.g. 100101 */
  subdistrictCode: number;
  /** Sub-district name in Thai (ตำบล / แขวง) */
  subdistrictNameTh: string;
  /** Sub-district name in English */
  subdistrictNameEn: string;
  /**
   * Representative latitude for the postal code area.
   * Sourced from rathpanyowat/Thai-zip-code-latitude-and-longitude.
   * `null` when the postal code is not present in that dataset.
   */
  lat: number | null;
  /**
   * Representative longitude for the postal code area.
   * `null` when the postal code is not present in that dataset.
   */
  lng: number | null;
}

/**
 * A single sub-district entry with bilingual names and its numeric code.
 */
export interface SubdistrictEntry {
  subdistrictNameTh: string;
  subdistrictNameEn: string;
  subdistrictCode: number;
}

/**
 * Full address result from a postal code lookup.
 */
export interface ThaiAddressResult {
  /** Thai postal code (5 digits) */
  postalCode: string;
  provinceNameTh: string;
  provinceNameEn: string;
  districtNameTh: string;
  districtNameEn: string;
  /** All sub-districts belonging to this postal code, sorted by Thai name */
  subdistricts: SubdistrictEntry[];
  /** Representative latitude — null if not available */
  lat: number | null;
  /** Representative longitude — null if not available */
  lng: number | null;
}

/**
 * Lightweight autofill result — province, district, and sub-district list.
 * Use to prefill form fields and populate a subdistrict <select>.
 */
export interface ThaiAutofillResult {
  postalCode: string;
  provinceNameTh: string;
  provinceNameEn: string;
  districtNameTh: string;
  districtNameEn: string;
  subdistricts: SubdistrictEntry[];
}

/**
 * Options for configuring lookup behaviour.
 */
export interface LookupOptions {
  /**
   * When `true`, returns `null` for unrecognized codes instead of throwing.
   * @default false
   */
  silent?: boolean;
}

/**
 * A single flat row result from text-based address search.
 */
export interface ThaiSearchResult {
  postalCode: string;
  provinceNameTh: string;
  provinceNameEn: string;
  districtNameTh: string;
  districtNameEn: string;
  subdistrictNameTh: string;
  subdistrictNameEn: string;
  lat: number | null;
  lng: number | null;
}
