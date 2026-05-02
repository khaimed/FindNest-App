/**
 * Validates the NormalizedProduct shape that every scraper must produce.
 * Does NOT make real network calls — tests the contract, not the live sites.
 */

const REQUIRED_FIELDS = [
  'id', 'title', 'price', 'oldPrice', 'currency',
  'url', 'image', 'website', 'seller',
  'rating', 'reviewCount', 'availability',
  'deliveryInfo', 'location', 'scrapedAt',
  'score', 'scoreExplanation',
];

const EXAMPLE = {
  id:               'abc-123',
  title:            'Samsung Galaxy A54 128Go',
  price:            3200,
  oldPrice:         3800,
  currency:         'MAD',
  url:              'https://www.jumia.ma/samsung-galaxy-a54.html',
  image:            'https://cdn.jumia.is/samsung.jpg',
  website:          'jumia.ma',
  seller:           null,
  rating:           4.3,
  reviewCount:      87,
  availability:     true,
  deliveryInfo:     'Livraison gratuite',
  location:         null,
  scrapedAt:        new Date().toISOString(),
  score:            72,
  scoreExplanation: ['Prix 3200 MAD (80/100)', 'Note 4.3/5', '87 avis'],
};

describe('NormalizedProduct shape', () => {
  REQUIRED_FIELDS.forEach(field => {
    test(`has field: ${field}`, () => {
      expect(EXAMPLE).toHaveProperty(field);
    });
  });

  test('price is number or null', () => {
    expect(
      EXAMPLE.price === null || typeof EXAMPLE.price === 'number'
    ).toBe(true);
  });

  test('oldPrice is number or null', () => {
    expect(
      EXAMPLE.oldPrice === null || typeof EXAMPLE.oldPrice === 'number'
    ).toBe(true);
  });

  test('availability is boolean', () => {
    expect(typeof EXAMPLE.availability).toBe('boolean');
  });

  test('scoreExplanation is array of strings', () => {
    expect(Array.isArray(EXAMPLE.scoreExplanation)).toBe(true);
    EXAMPLE.scoreExplanation.forEach(s => expect(typeof s).toBe('string'));
  });

  test('scrapedAt is valid ISO-8601 date', () => {
    const d = new Date(EXAMPLE.scrapedAt);
    expect(d.toISOString()).toBe(EXAMPLE.scrapedAt);
  });

  test('score is 0–100', () => {
    expect(EXAMPLE.score).toBeGreaterThanOrEqual(0);
    expect(EXAMPLE.score).toBeLessThanOrEqual(100);
  });

  test('url is a non-empty string', () => {
    expect(typeof EXAMPLE.url).toBe('string');
    expect(EXAMPLE.url.length).toBeGreaterThan(0);
  });
});

describe('price-parser integration', () => {
  const { parsePrice } = require('../src/main/services/utils/price-parser');

  const cases = [
    ['3 200 DH',      3200  ],
    ['3.200,00 DH',   3200  ],
    ['3,200.00 MAD',  3200  ],
    ['150',           150   ],
    ['',              null  ],
    [null,            null  ],
    ['Gratuit',       null  ],
  ];

  cases.forEach(([input, expected]) => {
    test(`parsePrice(${JSON.stringify(input)}) = ${expected}`, () => {
      expect(parsePrice(input)).toBe(expected);
    });
  });
});
