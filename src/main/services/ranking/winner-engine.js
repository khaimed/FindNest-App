/**
 * Scoring weights (must sum to 1.0).
 * Adjust values to change ranking priorities.
 */
const DEFAULT_WEIGHTS = {
  price:      0.35, // lower price → higher score
  rating:     0.20, // 0–5 stars
  reviewCount: 0.15, // more reviews = more trustworthy
  availability: 0.10, // in-stock bonus
  delivery:   0.05, // has delivery info
  titleMatch: 0.15, // keyword relevance
};

/**
 * Score and rank a list of normalized products.
 *
 * @param {NormalizedProduct[]} products
 * @param {string} keyword
 * @param {object} [weights]
 * @returns {NormalizedProduct[]}  sorted by score descending
 */
function rankProducts(products, keyword, weights = DEFAULT_WEIGHTS) {
  if (!products || products.length === 0) return [];

  // Only score products that have at least a title
  const scoreable = products.filter(p => p.title);
  if (scoreable.length === 0) return products;

  // Gather stats for normalization
  const prices      = scoreable.map(p => p.price).filter(v => v !== null && v > 0);
  const minPrice    = prices.length ? Math.min(...prices) : 0;
  const maxPrice    = prices.length ? Math.max(...prices) : 1;
  const priceRange  = maxPrice - minPrice || 1;

  const reviews     = scoreable.map(p => p.reviewCount || 0);
  const maxReviews  = Math.max(...reviews, 1);

  const scored = scoreable.map(p => {
    const explanation = [];
    let total = 0;

    // ── Price ─────────────────────────────────────────────────────────────
    const priceScore = p.price !== null && p.price > 0
      ? 1 - (p.price - minPrice) / priceRange
      : 0;
    total += priceScore * weights.price;
    if (p.price !== null) {
      explanation.push(`Prix ${p.price.toLocaleString('fr-MA')} MAD (${Math.round(priceScore * 100)}/100)`);
    }

    // ── Rating ────────────────────────────────────────────────────────────
    const ratingScore = p.rating ? Math.min(p.rating / 5, 1) : 0.2;
    total += ratingScore * weights.rating;
    if (p.rating) explanation.push(`Note ${p.rating}/5`);

    // ── Review count (log scale) ──────────────────────────────────────────
    const reviewScore = p.reviewCount
      ? Math.min(Math.log10(p.reviewCount + 1) / Math.log10(maxReviews + 1), 1)
      : 0.05;
    total += reviewScore * weights.reviewCount;
    if (p.reviewCount) explanation.push(`${p.reviewCount} avis`);

    // ── Availability ──────────────────────────────────────────────────────
    const availScore = p.availability ? 1 : 0;
    total += availScore * weights.availability;
    if (!p.availability) explanation.push('Non disponible');

    // ── Delivery ──────────────────────────────────────────────────────────
    const delivScore = p.deliveryInfo ? 0.9 : 0.3;
    total += delivScore * weights.delivery;
    if (p.deliveryInfo) explanation.push(`Livraison: ${p.deliveryInfo}`);

    // ── Title match ───────────────────────────────────────────────────────
    const titleScore = _titleMatch(p.title, keyword);
    total += titleScore * weights.titleMatch;
    if (titleScore > 0.7) explanation.push('Bonne correspondance');
    else if (titleScore < 0.3) explanation.push('Correspondance faible');

    return {
      ...p,
      score:            Math.round(Math.min(total, 1) * 100),
      scoreExplanation: explanation,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // Products that couldn't be scored (no title) go at the end
  const scoredIds = new Set(scored.map(p => p.id));
  const rest      = products.filter(p => !scoredIds.has(p.id));

  return [...scored, ...rest];
}

function getWinner(ranked) {
  return ranked.length > 0 ? ranked[0] : null;
}

function _titleMatch(title, keyword) {
  if (!title || !keyword) return 0;
  const words = keyword.toLowerCase().split(/\s+/).filter(w => w.length > 1);
  if (words.length === 0) return 0.5;
  const t       = title.toLowerCase();
  const matched = words.filter(w => t.includes(w)).length;
  return matched / words.length;
}

module.exports = { rankProducts, getWinner, DEFAULT_WEIGHTS };
