/**
 * Parse Moroccan/international price strings into a float.
 *
 * Handled formats:
 *   "1 500 DH"        → 1500
 *   "1 500,00 DH"     → 1500
 *   "1.500,00"        → 1500   (European)
 *   "1,500.00 MAD"    → 1500   (US)
 *   "1500"            → 1500
 */
function parsePrice(raw) {
  if (!raw || typeof raw !== 'string') return null;

  // Strip currency labels
  let s = raw.replace(/[dD][hH]|MAD|€|\$|£|درهم/g, '').trim();

  const commas = (s.match(/,/g) || []).length;
  const dots   = (s.match(/\./g) || []).length;

  if (commas === 1 && dots === 0) {
    const parts = s.split(',');
    // "1,50" → decimal; "1,500" → thousands
    s = parts[1] && parts[1].length <= 2 ? s.replace(',', '.') : s.replace(',', '');
  } else if (commas === 1 && dots === 1) {
    const commaIdx = s.indexOf(',');
    const dotIdx   = s.indexOf('.');
    if (dotIdx < commaIdx) {
      // European "1.500,00"
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // US "1,500.00"
      s = s.replace(/,/g, '');
    }
  } else if (commas > 1) {
    s = s.replace(/,/g, '');
  } else if (dots > 1) {
    s = s.replace(/\./g, '');
  }

  // Remove spaces (thousands separator)
  s = s.replace(/\s/g, '');

  const value = parseFloat(s);
  return isNaN(value) || value <= 0 ? null : value;
}

function formatPrice(price, currency = 'MAD') {
  if (price === null || price === undefined) return 'Prix non disponible';
  return `${price.toLocaleString('fr-MA')} ${currency}`;
}

module.exports = { parsePrice, formatPrice };
