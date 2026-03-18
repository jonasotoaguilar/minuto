export type PhoneCountry = {
  code: string;
  name: string;
  dialCode: string;
  nationalLength: number;
  pattern: string;
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  {
    code: 'CL',
    name: 'Chile',
    dialCode: '56',
    nationalLength: 9,
    pattern: 'X XXXX XXXX',
  },
  {
    code: 'AR',
    name: 'Argentina',
    dialCode: '54',
    nationalLength: 10,
    pattern: 'XX XXXX XXXX',
  },
  {
    code: 'PE',
    name: 'Peru',
    dialCode: '51',
    nationalLength: 9,
    pattern: 'XXX XXX XXX',
  },
  {
    code: 'CO',
    name: 'Colombia',
    dialCode: '57',
    nationalLength: 10,
    pattern: 'XXX XXX XXXX',
  },
  {
    code: 'MX',
    name: 'Mexico',
    dialCode: '52',
    nationalLength: 10,
    pattern: 'XXX XXX XXXX',
  },
  {
    code: 'US',
    name: 'United States',
    dialCode: '1',
    nationalLength: 10,
    pattern: 'XXX XXX XXXX',
  },
  {
    code: 'ES',
    name: 'Espana',
    dialCode: '34',
    nationalLength: 9,
    pattern: 'XXX XX XX XX',
  },
  {
    code: 'BR',
    name: 'Brazil',
    dialCode: '55',
    nationalLength: 11,
    pattern: 'XX XXXXX XXXX',
  },
  {
    code: 'UY',
    name: 'Uruguay',
    dialCode: '598',
    nationalLength: 8,
    pattern: 'XXXX XXXX',
  },
  {
    code: 'PY',
    name: 'Paraguay',
    dialCode: '595',
    nationalLength: 9,
    pattern: 'XXX XXX XXX',
  },
  {
    code: 'BO',
    name: 'Bolivia',
    dialCode: '591',
    nationalLength: 8,
    pattern: 'XXXX XXXX',
  },
  {
    code: 'EC',
    name: 'Ecuador',
    dialCode: '593',
    nationalLength: 9,
    pattern: 'XXX XXX XXX',
  },
  {
    code: 'VE',
    name: 'Venezuela',
    dialCode: '58',
    nationalLength: 10,
    pattern: 'XXX XXX XXXX',
  },
  {
    code: 'CR',
    name: 'Costa Rica',
    dialCode: '506',
    nationalLength: 8,
    pattern: 'XXXX XXXX',
  },
  {
    code: 'PA',
    name: 'Panama',
    dialCode: '507',
    nationalLength: 8,
    pattern: 'XXXX XXXX',
  },
  {
    code: 'GT',
    name: 'Guatemala',
    dialCode: '502',
    nationalLength: 8,
    pattern: 'XXXX XXXX',
  },
  {
    code: 'SV',
    name: 'El Salvador',
    dialCode: '503',
    nationalLength: 8,
    pattern: 'XXXX XXXX',
  },
  {
    code: 'HN',
    name: 'Honduras',
    dialCode: '504',
    nationalLength: 8,
    pattern: 'XXXX XXXX',
  },
  {
    code: 'NI',
    name: 'Nicaragua',
    dialCode: '505',
    nationalLength: 8,
    pattern: 'XXXX XXXX',
  },
  {
    code: 'DE',
    name: 'Germany',
    dialCode: '49',
    nationalLength: 11,
    pattern: 'XXX XXXX XXXX',
  },
  {
    code: 'FR',
    name: 'France',
    dialCode: '33',
    nationalLength: 9,
    pattern: 'X XX XX XX XX',
  },
  {
    code: 'IT',
    name: 'Italy',
    dialCode: '39',
    nationalLength: 10,
    pattern: 'XXX XXX XXXX',
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    dialCode: '44',
    nationalLength: 10,
    pattern: 'XXXX XXX XXX',
  },
  {
    code: 'PT',
    name: 'Portugal',
    dialCode: '351',
    nationalLength: 9,
    pattern: 'XXX XXX XXX',
  },
  {
    code: 'NL',
    name: 'Netherlands',
    dialCode: '31',
    nationalLength: 9,
    pattern: 'XX XXX XXXX',
  },
  {
    code: 'BE',
    name: 'Belgium',
    dialCode: '32',
    nationalLength: 9,
    pattern: 'XXX XX XX XX',
  },
  {
    code: 'CH',
    name: 'Switzerland',
    dialCode: '41',
    nationalLength: 9,
    pattern: 'XX XXX XX XX',
  },
  {
    code: 'SE',
    name: 'Sweden',
    dialCode: '46',
    nationalLength: 9,
    pattern: 'XX XXX XX XX',
  },
  {
    code: 'NO',
    name: 'Norway',
    dialCode: '47',
    nationalLength: 8,
    pattern: 'XXX XX XXX',
  },
  {
    code: 'DK',
    name: 'Denmark',
    dialCode: '45',
    nationalLength: 8,
    pattern: 'XX XX XX XX',
  },
  {
    code: 'IE',
    name: 'Ireland',
    dialCode: '353',
    nationalLength: 9,
    pattern: 'XX XXX XXXX',
  },
  {
    code: 'AU',
    name: 'Australia',
    dialCode: '61',
    nationalLength: 9,
    pattern: 'XXX XXX XXX',
  },
  {
    code: 'NZ',
    name: 'New Zealand',
    dialCode: '64',
    nationalLength: 9,
    pattern: 'XXX XXX XXX',
  },
  {
    code: 'JP',
    name: 'Japan',
    dialCode: '81',
    nationalLength: 10,
    pattern: 'XX XXXX XXXX',
  },
  {
    code: 'KR',
    name: 'South Korea',
    dialCode: '82',
    nationalLength: 10,
    pattern: 'XX XXXX XXXX',
  },
  {
    code: 'IN',
    name: 'India',
    dialCode: '91',
    nationalLength: 10,
    pattern: 'XXXXX XXXXX',
  },
  {
    code: 'SG',
    name: 'Singapore',
    dialCode: '65',
    nationalLength: 8,
    pattern: 'XXXX XXXX',
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    dialCode: '971',
    nationalLength: 9,
    pattern: 'XX XXX XXXX',
  },
  {
    code: 'ZA',
    name: 'South Africa',
    dialCode: '27',
    nationalLength: 9,
    pattern: 'XX XXX XXXX',
  },
];

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
