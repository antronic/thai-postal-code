/**
 * thai-postal-code
 *
 * Autofill Thai province and district from a postal code,
 * with bilingual (Thai + English) subdistrict listing.
 *
 * All functions are synchronous — data is indexed at module load time.
 *
 * @module
 */

// Types
export type {
  RawThaiRecord,
  SubdistrictEntry,
  ThaiAddressResult,
  ThaiAutofillResult,
  ThaiSearchResult,
  LookupOptions,
} from "./types/index";

// Core API
export {
  lookupByPostalCode,
  autofillByPostalCode,
  getSubdistrictsByPostalCode,
  listProvinces,
  listDistrictsByProvince,
  searchAddress,
  listAllPostalCodes,
} from "./utils/lookup";
