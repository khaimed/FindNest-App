const { rankProducts, getWinner, DEFAULT_WEIGHTS } = require('../src/main/services/ranking/winner-engine');

const base = (overrides = {}) => ({
  id:               'p-' + Math.random().toString(36).slice(2),
  title:            'Laptop Dell 15 pouces',
  price:            5000,
  oldPrice:         null,
  currency:         'MAD',
  url:              'https://example.com/product',
  image:            null,
  website:          'test.ma',
  seller:           null,
  rating:           null,
  reviewCount:      null,
  availability:     true,
  deliveryInfo:     null,
  location:         null,
  scrapedAt:        new Date().toISOString(),
  score:            0,
  scoreExplanation: [],
  ...overrides,
});

describe('rankProducts', () => {
  test('empty input returns empty array', () => {
    expect(rankProducts([], 'laptop')).toEqual([]);
  });

  test('cheaper product ranks higher when everything else is equal', () => {
    const cheap     = base({ price: 1000 });
    const expensive = base({ price: 9000 });
    const [first]   = rankProducts([expensive, cheap], 'laptop');
    expect(first.id).toBe(cheap.id);
  });

  test('higher-rated product ranks higher at equal price', () => {
    const great = base({ price: 3000, rating: 4.9, reviewCount: 200 });
    const poor  = base({ price: 3000, rating: 2.0, reviewCount: 3 });
    const [first] = rankProducts([poor, great], 'laptop');
    expect(first.id).toBe(great.id);
  });

  test('all scores are in [0, 100]', () => {
    const products = [
      base({ price: 500 }),
      base({ price: 2000, rating: 4.5, reviewCount: 50 }),
      base({ price: 10000 }),
    ];
    rankProducts(products, 'laptop').forEach(p => {
      expect(p.score).toBeGreaterThanOrEqual(0);
      expect(p.score).toBeLessThanOrEqual(100);
    });
  });

  test('scoreExplanation is a non-empty array', () => {
    const [p] = rankProducts([base({ price: 2000 })], 'laptop');
    expect(Array.isArray(p.scoreExplanation)).toBe(true);
    expect(p.scoreExplanation.length).toBeGreaterThan(0);
  });

  test('unavailable product scores lower than identical in-stock product', () => {
    const inStock  = base({ price: 3000, availability: true  });
    const outStock = base({ price: 3000, availability: false });
    const [first]  = rankProducts([outStock, inStock], 'laptop');
    expect(first.id).toBe(inStock.id);
  });

  test('title match improves score', () => {
    const match   = base({ price: 3000, title: 'Laptop Dell 15 pouces i7' });
    const noMatch = base({ price: 3000, title: 'Chaussures Nike Air Max' });
    const ranked  = rankProducts([noMatch, match], 'laptop dell');
    expect(ranked[0].id).toBe(match.id);
  });

  test('products without title are not dropped', () => {
    const withTitle    = base({ price: 1000, title: 'Produit test' });
    const withoutTitle = base({ price: 500,  title: '' });
    const ranked       = rankProducts([withTitle, withoutTitle], 'test');
    expect(ranked.length).toBe(2);
  });
});

describe('getWinner', () => {
  test('returns first element of ranked list', () => {
    const a = base({ score: 80 });
    const b = base({ score: 50 });
    expect(getWinner([a, b]).id).toBe(a.id);
  });

  test('returns null for empty array', () => {
    expect(getWinner([])).toBeNull();
  });
});

describe('DEFAULT_WEIGHTS', () => {
  test('weights sum to 1.0', () => {
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
  });
});
