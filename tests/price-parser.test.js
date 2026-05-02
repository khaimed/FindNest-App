const { parsePrice } = require('../src/main/services/utils/price-parser');

describe('parsePrice', () => {
  // Basic integers
  test('plain integer',              () => expect(parsePrice('1500')).toBe(1500));
  test('with DH suffix',             () => expect(parsePrice('1500 DH')).toBe(1500));
  test('lowercase dh',               () => expect(parsePrice('150dh')).toBe(150));
  test('MAD suffix',                 () => expect(parsePrice('150 MAD')).toBe(150));

  // Moroccan thousands-space format
  test('space thousands separator',  () => expect(parsePrice('1 500 DH')).toBe(1500));
  test('space + comma decimal',      () => expect(parsePrice('1 500,00 DH')).toBe(1500));

  // European format
  test('dot thousands comma decimal', () => expect(parsePrice('1.500,00')).toBe(1500));

  // US format
  test('comma thousands dot decimal', () => expect(parsePrice('1,500.00 MAD')).toBe(1500));

  // Plain decimal
  test('dot decimal',                () => expect(parsePrice('1500.50')).toBe(1500.50));

  // Small comma decimal like "4,50"
  test('small comma decimal',        () => expect(parsePrice('4,50 DH')).toBe(4.50));

  // Edge cases
  test('null input',                 () => expect(parsePrice(null)).toBeNull());
  test('empty string',               () => expect(parsePrice('')).toBeNull());
  test('non-numeric string',         () => expect(parsePrice('Prix non disponible')).toBeNull());
  test('zero price',                 () => expect(parsePrice('0 DH')).toBeNull()); // 0 treated as invalid
});
