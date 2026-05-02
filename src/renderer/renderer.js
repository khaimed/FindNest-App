/* global findnest */
'use strict';

// ── Social links ─────────────────────────────────────────────────────────────
const SOCIAL = {
  khaimed_button:   'https://www.khaimed.com/',
  facebook_button:  'https://www.facebook.com/khaimedev',
  instagram_button: 'https://www.instagram.com/khaimedev',
  linkedin_button:  'https://www.linkedin.com/in/khaimed',
  twitter_button:   'https://www.twitter.com/khaimed1',
  youtube_button:   'https://www.youtube.com/@khaimedev',
};

Object.entries(SOCIAL).forEach(([id, url]) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', () => findnest.openExternal(url));
});

// ── Populate site select ──────────────────────────────────────────────────────
async function initSites() {
  const sites  = await findnest.getSites();
  const select = document.getElementById('site-select');
  sites.forEach(site => {
    const opt = document.createElement('option');
    opt.value       = site;
    opt.textContent = site.charAt(0).toUpperCase() + site.slice(1) + '.ma';
    select.appendChild(opt);
  });
}

// ── Search state ──────────────────────────────────────────────────────────────
let currentKeyword = '';
let searchSeq      = 0; // monotonic counter; stale events are ignored

async function doSearch() {
  const keyword = document.getElementById('search-input').value.trim();
  const site    = document.getElementById('site-select').value;
  if (!keyword) { document.getElementById('search-input').focus(); return; }

  const seq     = ++searchSeq;
  currentKeyword = keyword;

  clearResults();
  setProgressVisible(true);
  setResultsVisible(false);

  const btn = document.getElementById('search-btn');
  btn.disabled    = true;
  btn.textContent = 'Recherche…';

  setProgress(0, 'Démarrage de la recherche…');

  // Detach stale listeners first
  findnest.removeAllListeners('search-progress');
  findnest.removeAllListeners('search-complete');
  findnest.removeAllListeners('search-error');

  findnest.onProgress(({ site: s, percent, error, count }) => {
    if (searchSeq !== seq) return;
    setProgress(percent, `${s} terminé`);
    addSiteTag(s, error ? 'error' : 'done', error ? `${s} ✗` : `${s} ✓ (${count})`);
  });

  findnest.onSearchComplete(({ products, winner, total, keyword: kw }) => {
    if (searchSeq !== seq) return;
    setProgressVisible(false);
    btn.disabled    = false;
    btn.textContent = 'Rechercher';

    document.getElementById('results-meta').textContent =
      `${total} produit${total !== 1 ? 's' : ''} trouvé${total !== 1 ? 's' : ''} pour « ${kw} »`;

    if (total === 0) {
      document.getElementById('winner-zone').innerHTML =
        '<p style="color:rgba(255,255,255,.5);padding:20px;text-align:center">Aucun résultat trouvé. Essayez un autre mot-clé.</p>';
    } else {
      renderWinner(winner);
      renderProducts(products);
    }
    setResultsVisible(true);
  });

  findnest.onSearchError(({ message }) => {
    if (searchSeq !== seq) return;
    setProgressVisible(false);
    btn.disabled    = false;
    btn.textContent = 'Rechercher';
    showToast(`Erreur: ${message}`, 'error');
  });

  const sites = site === 'all' ? 'all' : [site];
  await findnest.search(keyword, sites);
}

// ── Progress helpers ──────────────────────────────────────────────────────────
function setProgressVisible(v) {
  document.getElementById('progress-zone').style.display = v ? 'block' : 'none';
}

function setProgress(pct, label) {
  document.getElementById('progress-fill').style.width  = pct + '%';
  document.getElementById('progress-label').textContent = label;
}

function addSiteTag(site, state, text) {
  const tags = document.getElementById('site-tags');
  // Update existing tag if present
  let tag = tags.querySelector(`[data-site="${site}"]`);
  if (!tag) {
    tag = document.createElement('span');
    tag.className      = 'site-tag';
    tag.dataset.site   = site;
    tags.appendChild(tag);
  }
  tag.className   = `site-tag ${state}`;
  tag.textContent = text;
}

// ── Results helpers ───────────────────────────────────────────────────────────
function setResultsVisible(v) {
  const overlay = document.getElementById('results-overlay');
  overlay.classList.toggle('visible', v);
}

function clearResults() {
  document.getElementById('products-grid').innerHTML = '';
  document.getElementById('winner-zone').innerHTML   = '';
  document.getElementById('site-tags').innerHTML     = '';
}

// ── Winner card ───────────────────────────────────────────────────────────────
function renderWinner(winner) {
  if (!winner) return;
  const zone = document.getElementById('winner-zone');

  const imgHtml = winner.image
    ? `<img class="winner-img" src="${esc(winner.image)}" alt="" loading="lazy">`
    : '';

  const oldPriceHtml = winner.oldPrice
    ? `<div class="winner-old-price">${winner.oldPrice.toLocaleString('fr-MA')} MAD</div>`
    : '';

  zone.innerHTML = `
    <div class="winner-card">
      <div class="winner-badge">🏆 Meilleur Produit</div>
      ${imgHtml}
      <div class="winner-info">
        <h2 class="winner-title">${esc(winner.title)}</h2>
        <div class="winner-price">${winner.price ? winner.price.toLocaleString('fr-MA') + ' MAD' : 'Prix non disponible'}</div>
        ${oldPriceHtml}
        <div class="winner-score">Score global : <strong>${winner.score}/100</strong></div>
        <div class="winner-explanation">${esc((winner.scoreExplanation || []).join(' • '))}</div>
        <div class="winner-meta">
          ${tag('tag-site', winner.website)}
          ${winner.location  ? tag('tag-location', '📍 ' + winner.location)              : ''}
          ${winner.rating    ? tag('tag-rating',   '⭐ ' + winner.rating + '/5')          : ''}
          ${winner.reviewCount ? tag('tag-reviews', winner.reviewCount + ' avis')          : ''}
        </div>
        <a class="winner-link" data-url="${esc(winner.url)}">Voir le produit →</a>
      </div>
    </div>`;

  zone.querySelector('.winner-link').addEventListener('click', () => {
    findnest.openExternal(winner.url);
  });
}

// ── Products grid ─────────────────────────────────────────────────────────────
function renderProducts(products) {
  const grid = document.getElementById('products-grid');
  grid.innerHTML = '';

  products.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'product-card' + (i === 0 ? ' is-winner' : '');

    const imgHtml = p.image
      ? `<img class="product-img" src="${esc(p.image)}" alt="" loading="lazy">`
      : `<div class="product-no-img">Pas d'image</div>`;

    const oldPriceHtml = p.oldPrice
      ? `<p class="product-old-price">${p.oldPrice.toLocaleString('fr-MA')} MAD</p>`
      : '';

    card.innerHTML = `
      <div class="rank-badge ${i === 0 ? 'gold' : ''}">#${i + 1}</div>
      <div class="score-badge">${p.score}/100</div>
      ${imgHtml}
      <div class="product-body">
        <p class="product-title">${esc(p.title)}</p>
        <p class="product-price">${p.price ? p.price.toLocaleString('fr-MA') + ' MAD' : 'N/A'}</p>
        ${oldPriceHtml}
        <div class="product-meta">
          ${tag('tag-site', p.website)}
          ${p.rating ? tag('tag-rating', '⭐ ' + p.rating) : ''}
          ${p.location ? tag('tag-location', '📍 ' + esc(p.location)) : ''}
        </div>
      </div>
      <button class="product-open-btn">Voir le produit →</button>`;

    card.querySelector('.product-open-btn').addEventListener('click', () => {
      findnest.openExternal(p.url);
    });

    grid.appendChild(card);
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tag(cls, text) {
  return `<span class="tag ${cls}">${text}</span>`;
}

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed;bottom:60px;left:50%;transform:translateX(-50%);
    background:${type === 'error' ? '#c0392b' : '#2288c8'};
    color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;z-index:9999;`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// ── Event wiring ──────────────────────────────────────────────────────────────
document.getElementById('search-btn').addEventListener('click', doSearch);

document.getElementById('search-input').addEventListener('keypress', e => {
  if (e.key === 'Enter') doSearch();
});

document.getElementById('close-btn').addEventListener('click', () => {
  setResultsVisible(false);
  clearResults();
});

document.getElementById('export-btn').addEventListener('click', async () => {
  const result = await findnest.exportExcel(currentKeyword);
  if (result.success) {
    showToast(`Exporté : ${result.filePath}`);
  } else if (result.reason && !result.reason.includes('Annulé')) {
    showToast(result.reason, 'error');
  }
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
initSites();
