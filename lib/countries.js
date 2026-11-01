/**
 * Countries for the "view as a visitor from…" filter. Each entry carries what a real visitor's browser
 * would send: primary locale, time zone and a representative location (the capital), plus the local
 * currency, calling code and country-code domains used to judge how strongly a site targets a country.
 * Applying a country changes language, locale, time zone and location signals; it does not move the
 * server's IP address, so sites that geo-target purely by IP address can still return the default page.
 */

// [code, name, locale, timezone, lat, lon]
const RAW = [
  ['US', 'United States', 'en-US', 'America/New_York', 38.9, -77.0], ['GB', 'United Kingdom', 'en-GB', 'Europe/London', 51.5, -0.12],
  ['IN', 'India', 'en-IN', 'Asia/Kolkata', 28.6, 77.2], ['CA', 'Canada', 'en-CA', 'America/Toronto', 45.4, -75.7],
  ['AU', 'Australia', 'en-AU', 'Australia/Sydney', -33.9, 151.2], ['NZ', 'New Zealand', 'en-NZ', 'Pacific/Auckland', -36.85, 174.76],
  ['IE', 'Ireland', 'en-IE', 'Europe/Dublin', 53.35, -6.26], ['SG', 'Singapore', 'en-SG', 'Asia/Singapore', 1.35, 103.82],
  ['ZA', 'South Africa', 'en-ZA', 'Africa/Johannesburg', -26.2, 28.04], ['DE', 'Germany', 'de-DE', 'Europe/Berlin', 52.52, 13.4],
  ['FR', 'France', 'fr-FR', 'Europe/Paris', 48.86, 2.35], ['ES', 'Spain', 'es-ES', 'Europe/Madrid', 40.42, -3.7],
  ['IT', 'Italy', 'it-IT', 'Europe/Rome', 41.9, 12.5], ['NL', 'Netherlands', 'nl-NL', 'Europe/Amsterdam', 52.37, 4.9],
  ['BE', 'Belgium', 'nl-BE', 'Europe/Brussels', 50.85, 4.35], ['CH', 'Switzerland', 'de-CH', 'Europe/Zurich', 46.95, 7.45],
  ['AT', 'Austria', 'de-AT', 'Europe/Vienna', 48.2, 16.37], ['SE', 'Sweden', 'sv-SE', 'Europe/Stockholm', 59.33, 18.07],
  ['NO', 'Norway', 'nb-NO', 'Europe/Oslo', 59.91, 10.75], ['DK', 'Denmark', 'da-DK', 'Europe/Copenhagen', 55.68, 12.57],
  ['FI', 'Finland', 'fi-FI', 'Europe/Helsinki', 60.17, 24.94], ['PL', 'Poland', 'pl-PL', 'Europe/Warsaw', 52.23, 21.01],
  ['PT', 'Portugal', 'pt-PT', 'Europe/Lisbon', 38.72, -9.14], ['GR', 'Greece', 'el-GR', 'Europe/Athens', 37.98, 23.73],
  ['TR', 'Türkiye', 'tr-TR', 'Europe/Istanbul', 41.01, 28.98], ['RU', 'Russia', 'ru-RU', 'Europe/Moscow', 55.75, 37.62],
  ['UA', 'Ukraine', 'uk-UA', 'Europe/Kyiv', 50.45, 30.52], ['CZ', 'Czechia', 'cs-CZ', 'Europe/Prague', 50.08, 14.44],
  ['RO', 'Romania', 'ro-RO', 'Europe/Bucharest', 44.43, 26.1], ['HU', 'Hungary', 'hu-HU', 'Europe/Budapest', 47.5, 19.04],
  ['BR', 'Brazil', 'pt-BR', 'America/Sao_Paulo', -23.55, -46.63], ['MX', 'Mexico', 'es-MX', 'America/Mexico_City', 19.43, -99.13],
  ['AR', 'Argentina', 'es-AR', 'America/Argentina/Buenos_Aires', -34.6, -58.38], ['CL', 'Chile', 'es-CL', 'America/Santiago', -33.45, -70.67],
  ['CO', 'Colombia', 'es-CO', 'America/Bogota', 4.71, -74.07], ['PE', 'Peru', 'es-PE', 'America/Lima', -12.05, -77.04],
  ['JP', 'Japan', 'ja-JP', 'Asia/Tokyo', 35.68, 139.69], ['KR', 'South Korea', 'ko-KR', 'Asia/Seoul', 37.57, 126.98],
  ['CN', 'China', 'zh-CN', 'Asia/Shanghai', 39.9, 116.4], ['HK', 'Hong Kong', 'zh-HK', 'Asia/Hong_Kong', 22.32, 114.17],
  ['TW', 'Taiwan', 'zh-TW', 'Asia/Taipei', 25.03, 121.56], ['TH', 'Thailand', 'th-TH', 'Asia/Bangkok', 13.75, 100.5],
  ['VN', 'Vietnam', 'vi-VN', 'Asia/Ho_Chi_Minh', 21.03, 105.85], ['ID', 'Indonesia', 'id-ID', 'Asia/Jakarta', -6.2, 106.82],
  ['MY', 'Malaysia', 'ms-MY', 'Asia/Kuala_Lumpur', 3.14, 101.69], ['PH', 'Philippines', 'en-PH', 'Asia/Manila', 14.6, 120.98],
  ['PK', 'Pakistan', 'ur-PK', 'Asia/Karachi', 33.69, 73.05], ['BD', 'Bangladesh', 'bn-BD', 'Asia/Dhaka', 23.81, 90.41],
  ['LK', 'Sri Lanka', 'si-LK', 'Asia/Colombo', 6.93, 79.85], ['NP', 'Nepal', 'ne-NP', 'Asia/Kathmandu', 27.72, 85.32],
  ['AE', 'United Arab Emirates', 'ar-AE', 'Asia/Dubai', 25.2, 55.27], ['SA', 'Saudi Arabia', 'ar-SA', 'Asia/Riyadh', 24.71, 46.68],
  ['QA', 'Qatar', 'ar-QA', 'Asia/Qatar', 25.29, 51.53], ['KW', 'Kuwait', 'ar-KW', 'Asia/Kuwait', 29.38, 47.99],
  ['IL', 'Israel', 'he-IL', 'Asia/Jerusalem', 31.77, 35.22], ['EG', 'Egypt', 'ar-EG', 'Africa/Cairo', 30.04, 31.24],
  ['NG', 'Nigeria', 'en-NG', 'Africa/Lagos', 6.52, 3.38], ['KE', 'Kenya', 'en-KE', 'Africa/Nairobi', -1.29, 36.82],
  ['MA', 'Morocco', 'ar-MA', 'Africa/Casablanca', 33.57, -7.59], ['GH', 'Ghana', 'en-GH', 'Africa/Accra', 5.6, -0.19],
];

// code -> [currency, unambiguous symbols, calling code, country-code domains (without the dot)]
const META = {
  US: ['USD', [], '1', ['us']], GB: ['GBP', ['£'], '44', ['uk', 'gb']], IN: ['INR', ['₹', 'Rs.'], '91', ['in']], CA: ['CAD', [], '1', ['ca']],
  AU: ['AUD', [], '61', ['au']], NZ: ['NZD', [], '64', ['nz']], IE: ['EUR', ['€'], '353', ['ie']], SG: ['SGD', [], '65', ['sg']],
  ZA: ['ZAR', [], '27', ['za']], DE: ['EUR', ['€'], '49', ['de']], FR: ['EUR', ['€'], '33', ['fr']], ES: ['EUR', ['€'], '34', ['es']],
  IT: ['EUR', ['€'], '39', ['it']], NL: ['EUR', ['€'], '31', ['nl']], BE: ['EUR', ['€'], '32', ['be']], CH: ['CHF', [], '41', ['ch']],
  AT: ['EUR', ['€'], '43', ['at']], SE: ['SEK', [], '46', ['se']], NO: ['NOK', [], '47', ['no']], DK: ['DKK', [], '45', ['dk']],
  FI: ['EUR', ['€'], '358', ['fi']], PL: ['PLN', ['zł'], '48', ['pl']], PT: ['EUR', ['€'], '351', ['pt']], GR: ['EUR', ['€'], '30', ['gr']],
  TR: ['TRY', ['₺'], '90', ['tr']], RU: ['RUB', ['₽'], '7', ['ru']], UA: ['UAH', ['₴'], '380', ['ua']], CZ: ['CZK', ['Kč'], '420', ['cz']],
  RO: ['RON', ['lei'], '40', ['ro']], HU: ['HUF', ['Ft'], '36', ['hu']], BR: ['BRL', ['R$'], '55', ['br']], MX: ['MXN', [], '52', ['mx']],
  AR: ['ARS', [], '54', ['ar']], CL: ['CLP', [], '56', ['cl']], CO: ['COP', [], '57', ['co']], PE: ['PEN', [], '51', ['pe']],
  JP: ['JPY', ['円'], '81', ['jp']], KR: ['KRW', ['₩', '원'], '82', ['kr']], CN: ['CNY', ['元', '人民币'], '86', ['cn']], HK: ['HKD', ['HK$'], '852', ['hk']],
  TW: ['TWD', ['NT$'], '886', ['tw']], TH: ['THB', ['฿'], '66', ['th']], VN: ['VND', ['₫'], '84', ['vn']], ID: ['IDR', ['Rp'], '62', ['id']],
  MY: ['MYR', ['RM'], '60', ['my']], PH: ['PHP', ['₱'], '63', ['ph']], PK: ['PKR', ['Rs.'], '92', ['pk']], BD: ['BDT', ['৳'], '880', ['bd']],
  LK: ['LKR', ['Rs.'], '94', ['lk']], NP: ['NPR', ['Rs.'], '977', ['np']], AE: ['AED', ['د.إ'], '971', ['ae']], SA: ['SAR', ['ر.س'], '966', ['sa']],
  QA: ['QAR', [], '974', ['qa']], KW: ['KWD', [], '965', ['kw']], IL: ['ILS', ['₪'], '972', ['il']], EG: ['EGP', ['E£'], '20', ['eg']],
  NG: ['NGN', ['₦'], '234', ['ng']], KE: ['KES', ['KSh'], '254', ['ke']], MA: ['MAD', [], '212', ['ma']], GH: ['GHS', ['GH₵'], '233', ['gh']],
};

export const COUNTRIES = RAW.map(([code, name, locale, timezone, lat, lon]) => ({
  code, name, locale, language: locale.split('-')[0], timezone, lat, lon,
  currency: META[code]?.[0] || '', symbols: META[code]?.[1] || [], dial: META[code]?.[2] || '', tlds: META[code]?.[3] || [code.toLowerCase()],
})).sort((a, b) => a.name.localeCompare(b.name));

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export const findCountry = (code) => (code ? BY_CODE.get(String(code).toUpperCase()) || null : null);

/** 🇮🇳 from "IN" using regional-indicator symbols. */
export const flagOf = (code) =>
  /^[A-Z]{2}$/.test(code || '') ? String.fromCodePoint(...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)) : '🌐';

/** The Accept-Language a visitor from this country would send. */
export function acceptLanguageFor(country) {
  if (!country) return 'en';
  return country.language === 'en' ? `${country.locale},en;q=0.9` : `${country.locale},${country.language};q=0.9,en;q=0.5`;
}

/** What we put in the report: small, serialisable. */
export const countryInfo = (country) => (country ? { code: country.code, name: country.name, locale: country.locale, language: country.language } : null);
