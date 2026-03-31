/**
 * VAT / Tax number validation per country.
 * Returns null if valid (or empty), or an error message string if invalid.
 */

function validatePortugueseNIF(vat: string): boolean {
  // Portuguese NIF/NIPC: exactly 9 digits
  if (!/^\d{9}$/.test(vat)) return false
  const digits = vat.split('').map(Number)
  const first = digits[0]
  // Valid first digits: 1-3 (individuals), 5 (public bodies), 6 (non-profits),
  // 7 (irregular groupings), 8 (sole traders), 45 (non-residents), 9 (legal entities)
  if (![1, 2, 3, 5, 6, 7, 8, 9].includes(first)) return false
  const sum = digits.slice(0, 8).reduce((acc, d, i) => acc + d * (9 - i), 0)
  const remainder = sum % 11
  const checkDigit = remainder < 2 ? 0 : 11 - remainder
  return digits[8] === checkDigit
}

function validateSpanishNIF(vat: string): boolean {
  const upper = vat.toUpperCase().trim()

  const NIF_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE'

  // Individual NIF: 8 digits + letter
  if (/^\d{8}[A-Z]$/.test(upper)) {
    const num = parseInt(upper.slice(0, 8), 10)
    return upper[8] === NIF_LETTERS[num % 23]
  }

  // NIE (foreigners): X/Y/Z + 7 digits + letter
  if (/^[XYZ]\d{7}[A-Z]$/.test(upper)) {
    const prefix: Record<string, string> = { X: '0', Y: '1', Z: '2' }
    const num = parseInt(prefix[upper[0]] + upper.slice(1, 8), 10)
    return upper[8] === NIF_LETTERS[num % 23]
  }

  // CIF (companies): letter + 7 digits + control char
  if (/^[ABCDEFGHJKLMNPQRSUVW]\d{7}[A-Z0-9]$/.test(upper)) {
    const digits = upper.slice(1, 8).split('').map(Number)
    let sum = 0
    digits.forEach((d, i) => {
      if ((i + 1) % 2 === 0) {
        sum += d
      } else {
        const doubled = d * 2
        sum += doubled > 9 ? doubled - 9 : doubled
      }
    })
    const control = (10 - (sum % 10)) % 10
    const controlLetter = 'JABCDEFGHI'[control]
    const last = upper[upper.length - 1]
    return last === String(control) || last === controlLetter
  }

  return false
}

// Maps EU VAT 2-letter prefixes to full country names (as stored in the app)
const VIES_PREFIX_TO_COUNTRY: Record<string, string> = {
  AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', CY: 'Cyprus',
  CZ: 'Czech Republic', DE: 'Germany', DK: 'Denmark', EE: 'Estonia',
  EL: 'Greece', ES: 'Spain', FI: 'Finland', FR: 'France',
  HR: 'Croatia', HU: 'Hungary', IE: 'Ireland', IT: 'Italy',
  LT: 'Lithuania', LU: 'Luxembourg', LV: 'Latvia', MT: 'Malta',
  NL: 'Netherlands', PL: 'Poland', PT: 'Portugal', RO: 'Romania',
  SE: 'Sweden', SI: 'Slovenia', SK: 'Slovakia',
}

/**
 * Detects the country from a EU VAT number prefix (e.g. "PT508276490" → "Portugal").
 * Returns null if the prefix is not a recognised EU VAT prefix.
 */
export function detectCountryFromVAT(vat: string): string | null {
  const prefix = vat.trim().slice(0, 2).toUpperCase()
  if (/^[A-Z]{2}$/.test(prefix)) {
    return VIES_PREFIX_TO_COUNTRY[prefix] ?? null
  }
  return null
}

export function validateVAT(vatNumber: string, country?: string): string | null {
  const vat = vatNumber.trim()
  if (!vat) return null // empty is allowed

  const c = (country || '').toLowerCase()

  if (c === 'portugal') {
    return validatePortugueseNIF(vat) ? null : 'NIF inválido'
  }

  if (c === 'spain') {
    return validateSpanishNIF(vat) ? null : 'NIF/CIF inválido'
  }

  // Generic: allow alphanumeric + hyphens, 4–20 chars
  if (!/^[A-Z0-9a-z\-. ]{4,20}$/.test(vat)) {
    return 'Número de contribuinte inválido'
  }

  return null
}
