# FindNest App

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A cross-platform Electron desktop app that scrapes Moroccan e-commerce and marketplace websites and ranks results to show you the **winner product** — the best deal based on price, rating, reviews, availability, and relevance.

---

## Features

- Search across **Avito.ma** and **Jumia.ma** simultaneously (more sites are easy to add)
- Smart scraping: Next.js `__NEXT_DATA__` JSON extraction → CSS-selector HTML fallback (no Selenium/browser required)
- **Winner ranking engine** with configurable weights (price · rating · reviews · availability · delivery · title match)
- Winner card with score explanation in the UI
- Export all ranked results to **Excel** (winner row highlighted in gold)
- Secure Electron setup: `contextIsolation: true`, `nodeIntegration: false`
- Per-site isolation — one failing site does not stop the rest
- Retry logic with exponential back-off per scraper
- 56 unit tests (price parsing · ranking engine · product schema)

---

## Architecture

```
src/
  main/
    main.js                         ← Electron main process (window + lifecycle)
    ipc.js                          ← All ipcMain handlers
    services/
      scraper/
        scraper.interface.js        ← BaseScraper contract + NormalizedProduct typedef
        scraper-manager.js          ← Runs scrapers in parallel, isolates failures
        sites/
          avito.scraper.js          ← Avito.ma: __NEXT_DATA__ → CSS fallback
          jumia.scraper.js          ← Jumia.ma: axios + Cheerio
      ranking/
        winner-engine.js            ← Weighted scoring, sorts products
      export/
        excel-exporter.js           ← ExcelJS, opens save dialog in main process
      storage/
        product-store.js            ← In-memory singleton, cleared per search
      utils/
        price-parser.js             ← Handles MAD/DH/European/US price formats
        logger.js                   ← Console logger with DEBUG=1 flag
  preload/
    preload.js                      ← contextBridge API (only safe methods exposed)
  renderer/
    index.html
    renderer.js                     ← Pure browser JS, talks through window.findnest
    styles.css
  img/                              ← Logo and social icons
tests/
  price-parser.test.js
  winner-engine.test.js
  scraper-output.test.js
```

---

## Supported websites

| Site | Strategy | Notes |
|------|----------|-------|
| avito.ma | Next.js `__NEXT_DATA__` → CSS fallback | Morocco's largest marketplace |
| jumia.ma | axios + Cheerio (`article.prd`) | Structured HTML catalog |

### Adding a new site

1. Create `src/main/services/scraper/sites/mysite.scraper.js` extending `BaseScraper`
2. Implement `async search(keyword)` returning `NormalizedProduct[]`
3. Register it in `scraper-manager.js` under the `SCRAPERS` object

---

## Normalized product schema

Every scraper returns objects with these fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique ID (from site or `crypto.randomUUID()`) |
| `title` | string | Product title |
| `price` | number\|null | Current price in MAD |
| `oldPrice` | number\|null | Crossed-out original price |
| `currency` | string | Always `"MAD"` |
| `url` | string | Product page URL |
| `image` | string\|null | Image URL |
| `website` | string | e.g. `"avito.ma"` |
| `seller` | string\|null | Seller name if available |
| `rating` | number\|null | 0–5 stars |
| `reviewCount` | number\|null | Number of reviews |
| `availability` | boolean | In stock? |
| `deliveryInfo` | string\|null | Delivery label/badge |
| `location` | string\|null | City / region |
| `scrapedAt` | string | ISO-8601 timestamp |
| `score` | number | 0–100 (set by winner engine) |
| `scoreExplanation` | string[] | Human-readable score breakdown |

---

## Scoring weights

Defined in `src/main/services/ranking/winner-engine.js`:

```js
const DEFAULT_WEIGHTS = {
  price:        0.35,  // lower price → higher score
  rating:       0.20,  // 0–5 stars normalized
  reviewCount:  0.15,  // log scale, more reviews = more trustworthy
  availability: 0.10,  // in-stock bonus
  delivery:     0.05,  // has delivery info
  titleMatch:   0.15,  // keyword word overlap
};
```

Change the values (must sum to 1.0) to reprioritize.

---

## Setup

### Requirements

- **Node.js** 18+ (tested on 20)
- No browser drivers needed by default

### Install

```bash
git clone https://github.com/khaimed/FindNest-App.git
cd FindNest-App
npm install
```

### Run (development)

```bash
npm start
```

### Run tests

```bash
npm test
```

### Build distributable

```bash
npm run make
```

---

## Usage

1. Launch with `npm start`
2. Type a product name (e.g. `Samsung Galaxy A54`)
3. Choose a specific site or leave **Tous les sites** for parallel search
4. Click **Rechercher** or press Enter
5. The **winner card** appears at the top with score breakdown
6. Browse all ranked results in the product grid
7. Click any product card to open it in your browser
8. Click **Exporter Excel** to save the ranked list (winner row in gold)

---

## Limitations

- **Avito.ma** uses Next.js SSR; if they move to client-side rendering only, the `__NEXT_DATA__` strategy falls back to CSS selectors (which may need updating after a redesign)
- **Jumia.ma** CSS selectors (`article.prd`, `.name`, `.prc`) are stable but could change after a major redesign
- No headless browser by default — heavily JS-rendered pages that block plain HTTP requests may return empty results. Add [Playwright](https://playwright.dev/) as a third strategy if needed
- Rating and seller data is not always available (Avito does not publish ratings)

---

## Legal & ethical scraping note

This tool is intended for **personal, educational, and research use only**.

- Respect each website's `robots.txt` and Terms of Service
- The app scrapes one page per site per search — do not abuse it for bulk harvesting
- Product data belongs to the respective websites and their sellers
- The author is not responsible for misuse of this software

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-site`
3. Commit your changes: `git commit -m 'Add: new-site scraper'`
4. Push and open a pull request

---

## License

MIT © Khalid Ait M'hamed · [khaimed.com](https://www.khaimed.com)
