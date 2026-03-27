import {
  type CountryCode,
  formatIncompletePhoneNumber,
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
} from 'libphonenumber-js';
import examples from 'libphonenumber-js/examples.mobile.json';

export type PhoneCountry = {
  code: string;
  name: string;
  dialCode: string;
  nationalLength: number;
  pattern: string;
};

/**
 * Static map of ISO 3166-1 alpha-2 codes to English country names.
 * Replaces Intl.DisplayNames which is not available in the Hermes JS engine
 * used by React Native on Android.
 */
const COUNTRY_NAMES: Record<string, string> = {
  AC: 'Ascension Island',
  AD: 'Andorra',
  AE: 'United Arab Emirates',
  AF: 'Afghanistan',
  AG: 'Antigua & Barbuda',
  AI: 'Anguilla',
  AL: 'Albania',
  AM: 'Armenia',
  AO: 'Angola',
  AR: 'Argentina',
  AS: 'American Samoa',
  AT: 'Austria',
  AU: 'Australia',
  AW: 'Aruba',
  AX: 'Åland Islands',
  AZ: 'Azerbaijan',
  BA: 'Bosnia & Herzegovina',
  BB: 'Barbados',
  BD: 'Bangladesh',
  BE: 'Belgium',
  BF: 'Burkina Faso',
  BG: 'Bulgaria',
  BH: 'Bahrain',
  BI: 'Burundi',
  BJ: 'Benin',
  BL: 'St. Barthélemy',
  BM: 'Bermuda',
  BN: 'Brunei',
  BO: 'Bolivia',
  BQ: 'Caribbean Netherlands',
  BR: 'Brazil',
  BS: 'Bahamas',
  BT: 'Bhutan',
  BW: 'Botswana',
  BY: 'Belarus',
  BZ: 'Belize',
  CA: 'Canada',
  CC: 'Cocos (Keeling) Islands',
  CD: 'Congo - Kinshasa',
  CF: 'Central African Republic',
  CG: 'Congo - Brazzaville',
  CH: 'Switzerland',
  CI: "Côte d'Ivoire",
  CK: 'Cook Islands',
  CL: 'Chile',
  CM: 'Cameroon',
  CN: 'China',
  CO: 'Colombia',
  CR: 'Costa Rica',
  CU: 'Cuba',
  CV: 'Cape Verde',
  CW: 'Curaçao',
  CX: 'Christmas Island',
  CY: 'Cyprus',
  CZ: 'Czechia',
  DE: 'Germany',
  DJ: 'Djibouti',
  DK: 'Denmark',
  DM: 'Dominica',
  DO: 'Dominican Republic',
  DZ: 'Algeria',
  EC: 'Ecuador',
  EE: 'Estonia',
  EG: 'Egypt',
  EH: 'Western Sahara',
  ER: 'Eritrea',
  ES: 'Spain',
  ET: 'Ethiopia',
  FI: 'Finland',
  FJ: 'Fiji',
  FK: 'Falkland Islands',
  FM: 'Micronesia',
  FO: 'Faroe Islands',
  FR: 'France',
  GA: 'Gabon',
  GB: 'United Kingdom',
  GD: 'Grenada',
  GE: 'Georgia',
  GF: 'French Guiana',
  GG: 'Guernsey',
  GH: 'Ghana',
  GI: 'Gibraltar',
  GL: 'Greenland',
  GM: 'Gambia',
  GN: 'Guinea',
  GP: 'Guadeloupe',
  GQ: 'Equatorial Guinea',
  GR: 'Greece',
  GT: 'Guatemala',
  GU: 'Guam',
  GW: 'Guinea-Bissau',
  GY: 'Guyana',
  HK: 'Hong Kong SAR China',
  HN: 'Honduras',
  HR: 'Croatia',
  HT: 'Haiti',
  HU: 'Hungary',
  ID: 'Indonesia',
  IE: 'Ireland',
  IL: 'Israel',
  IM: 'Isle of Man',
  IN: 'India',
  IO: 'British Indian Ocean Territory',
  IQ: 'Iraq',
  IR: 'Iran',
  IS: 'Iceland',
  IT: 'Italy',
  JE: 'Jersey',
  JM: 'Jamaica',
  JO: 'Jordan',
  JP: 'Japan',
  KE: 'Kenya',
  KG: 'Kyrgyzstan',
  KH: 'Cambodia',
  KI: 'Kiribati',
  KM: 'Comoros',
  KN: 'St. Kitts & Nevis',
  KP: 'North Korea',
  KR: 'South Korea',
  KW: 'Kuwait',
  KY: 'Cayman Islands',
  KZ: 'Kazakhstan',
  LA: 'Laos',
  LB: 'Lebanon',
  LC: 'St. Lucia',
  LI: 'Liechtenstein',
  LK: 'Sri Lanka',
  LR: 'Liberia',
  LS: 'Lesotho',
  LT: 'Lithuania',
  LU: 'Luxembourg',
  LV: 'Latvia',
  LY: 'Libya',
  MA: 'Morocco',
  MC: 'Monaco',
  MD: 'Moldova',
  ME: 'Montenegro',
  MF: 'St. Martin',
  MG: 'Madagascar',
  MH: 'Marshall Islands',
  MK: 'North Macedonia',
  ML: 'Mali',
  MM: 'Myanmar (Burma)',
  MN: 'Mongolia',
  MO: 'Macao SAR China',
  MP: 'Northern Mariana Islands',
  MQ: 'Martinique',
  MR: 'Mauritania',
  MS: 'Montserrat',
  MT: 'Malta',
  MU: 'Mauritius',
  MV: 'Maldives',
  MW: 'Malawi',
  MX: 'Mexico',
  MY: 'Malaysia',
  MZ: 'Mozambique',
  NA: 'Namibia',
  NC: 'New Caledonia',
  NE: 'Niger',
  NF: 'Norfolk Island',
  NG: 'Nigeria',
  NI: 'Nicaragua',
  NL: 'Netherlands',
  NO: 'Norway',
  NP: 'Nepal',
  NR: 'Nauru',
  NU: 'Niue',
  NZ: 'New Zealand',
  OM: 'Oman',
  PA: 'Panama',
  PE: 'Peru',
  PF: 'French Polynesia',
  PG: 'Papua New Guinea',
  PH: 'Philippines',
  PK: 'Pakistan',
  PL: 'Poland',
  PM: 'St. Pierre & Miquelon',
  PR: 'Puerto Rico',
  PS: 'Palestinian Territories',
  PT: 'Portugal',
  PW: 'Palau',
  PY: 'Paraguay',
  QA: 'Qatar',
  RE: 'Réunion',
  RO: 'Romania',
  RS: 'Serbia',
  RU: 'Russia',
  RW: 'Rwanda',
  SA: 'Saudi Arabia',
  SB: 'Solomon Islands',
  SC: 'Seychelles',
  SD: 'Sudan',
  SE: 'Sweden',
  SG: 'Singapore',
  SH: 'St. Helena',
  SI: 'Slovenia',
  SJ: 'Svalbard & Jan Mayen',
  SK: 'Slovakia',
  SL: 'Sierra Leone',
  SM: 'San Marino',
  SN: 'Senegal',
  SO: 'Somalia',
  SR: 'Suriname',
  SS: 'South Sudan',
  ST: 'São Tomé & Príncipe',
  SV: 'El Salvador',
  SX: 'Sint Maarten',
  SY: 'Syria',
  SZ: 'Eswatini',
  TA: 'Tristan da Cunha',
  TC: 'Turks & Caicos Islands',
  TD: 'Chad',
  TG: 'Togo',
  TH: 'Thailand',
  TJ: 'Tajikistan',
  TK: 'Tokelau',
  TL: 'Timor-Leste',
  TM: 'Turkmenistan',
  TN: 'Tunisia',
  TO: 'Tonga',
  TR: 'Türkiye',
  TT: 'Trinidad & Tobago',
  TV: 'Tuvalu',
  TW: 'Taiwan',
  TZ: 'Tanzania',
  UA: 'Ukraine',
  UG: 'Uganda',
  US: 'United States',
  UY: 'Uruguay',
  UZ: 'Uzbekistan',
  VA: 'Vatican City',
  VC: 'St. Vincent & Grenadines',
  VE: 'Venezuela',
  VG: 'British Virgin Islands',
  VI: 'U.S. Virgin Islands',
  VN: 'Vietnam',
  VU: 'Vanuatu',
  WF: 'Wallis & Futuna',
  WS: 'Samoa',
  XK: 'Kosovo',
  YE: 'Yemen',
  YT: 'Mayotte',
  ZA: 'South Africa',
  ZM: 'Zambia',
  ZW: 'Zimbabwe',
};

function generateFallbackPattern(length: number): string {
  if (length <= 4) return 'X'.repeat(length);
  if (length <= 6) return 'XXX ' + 'X'.repeat(length - 3);
  if (length <= 8) return 'XXXX ' + 'X'.repeat(length - 4);

  const firstGroup = Math.ceil(length / 3);
  const secondGroup = Math.ceil((length - firstGroup) / 2);
  const thirdGroup = length - firstGroup - secondGroup;

  return (
    'X'.repeat(firstGroup) +
    ' ' +
    'X'.repeat(secondGroup) +
    ' ' +
    'X'.repeat(thirdGroup)
  );
}

function deriveNationalPattern(countryCode: CountryCode): {
  nationalLength: number;
  pattern: string;
} {
  const example = getExampleNumber(countryCode, examples);

  if (!example) {
    return { nationalLength: 10, pattern: generateFallbackPattern(10) };
  }

  const nationalDigits = example.nationalNumber;
  const nationalLength = nationalDigits.length;

  const formatted = formatIncompletePhoneNumber(nationalDigits, countryCode);
  const pattern = formatted
    .replace(/[()./\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\d/g, 'X');

  if (!pattern.includes(' ')) {
    return { nationalLength, pattern: generateFallbackPattern(nationalLength) };
  }

  return { nationalLength, pattern };
}

function buildPhoneCountry(countryCode: CountryCode): PhoneCountry {
  const name = COUNTRY_NAMES[countryCode] ?? countryCode;
  const dialCode = getCountryCallingCode(countryCode);
  const { nationalLength, pattern } = deriveNationalPattern(countryCode);

  return {
    code: countryCode,
    name,
    dialCode: String(dialCode),
    nationalLength,
    pattern,
  };
}

export const PHONE_COUNTRIES: PhoneCountry[] = getCountries()
  .map(buildPhoneCountry)
  .sort((left, right) => left.name.localeCompare(right.name));

export type PhoneCountryCode = string;

const DEFAULT_PHONE_COUNTRY_CODE: PhoneCountryCode = 'CL';

const countryByCode = new Map<PhoneCountryCode, PhoneCountry>(
  PHONE_COUNTRIES.map((country) => [country.code, country]),
);

const countriesByDialCodeDesc = [...PHONE_COUNTRIES].sort(
  (left, right) => right.dialCode.length - left.dialCode.length,
);

export function getPhoneCountry(code: PhoneCountryCode): PhoneCountry {
  const defaultCountry = countryByCode.get(DEFAULT_PHONE_COUNTRY_CODE);
  if (defaultCountry) {
    return countryByCode.get(code) ?? defaultCountry;
  }

  return PHONE_COUNTRIES[0];
}

export function sanitizePhoneDigits(value: string) {
  return value.replace(/\D/g, '');
}

function applyPhonePattern(digits: string, pattern: string) {
  let digitIndex = 0;
  let result = '';

  for (const token of pattern) {
    if (token === 'X') {
      if (digitIndex >= digits.length) break;
      result += digits[digitIndex];
      digitIndex += 1;
      continue;
    }
    if (digitIndex >= digits.length) break;
    result += token;
  }

  return result;
}

export function formatNationalPhone(
  countryCode: PhoneCountryCode,
  rawInput: string,
) {
  const country = getPhoneCountry(countryCode);
  const sanitizedDigits = sanitizePhoneDigits(rawInput).slice(
    0,
    country.nationalLength,
  );

  return {
    digits: sanitizedDigits,
    formatted: applyPhonePattern(sanitizedDigits, country.pattern),
  };
}

export function validateNationalPhone(
  countryCode: PhoneCountryCode,
  rawInput: string,
) {
  const country = getPhoneCountry(countryCode);
  const digits = sanitizePhoneDigits(rawInput);
  return digits.length === country.nationalLength;
}

export function toE164Phone(countryCode: PhoneCountryCode, rawInput: string) {
  const country = getPhoneCountry(countryCode);
  const digits = sanitizePhoneDigits(rawInput);
  return `+${country.dialCode}${digits}`;
}

export function parseE164Phone(value: string | null | undefined): {
  countryCode: PhoneCountryCode;
  nationalDigits: string;
} {
  const sanitized = sanitizePhoneDigits(value ?? '');

  if (!sanitized) {
    return {
      countryCode: DEFAULT_PHONE_COUNTRY_CODE,
      nationalDigits: '',
    };
  }

  const matchedCountry = countriesByDialCodeDesc.find((country) =>
    sanitized.startsWith(country.dialCode),
  );

  if (!matchedCountry) {
    return {
      countryCode: DEFAULT_PHONE_COUNTRY_CODE,
      nationalDigits: sanitized,
    };
  }

  return {
    countryCode: matchedCountry.code,
    nationalDigits: sanitized
      .slice(matchedCountry.dialCode.length)
      .slice(0, matchedCountry.nationalLength),
  };
}

export function countryCodeToFlag(countryCode: PhoneCountryCode) {
  const upperCode = countryCode.toUpperCase();
  const [first, second] = upperCode;

  if (!first || !second) {
    return '';
  }

  const base = 0x1f1e6;
  const firstOffset = first.charCodeAt(0) - 65;
  const secondOffset = second.charCodeAt(0) - 65;

  if (
    firstOffset < 0 ||
    firstOffset > 25 ||
    secondOffset < 0 ||
    secondOffset > 25
  ) {
    return '';
  }

  return String.fromCodePoint(base + firstOffset, base + secondOffset);
}
