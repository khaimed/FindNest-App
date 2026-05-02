const ExcelJS = require('exceljs');
const { dialog } = require('electron');
const path = require('path');
const os   = require('os');
const logger = require('../utils/logger');

/**
 * Open a save dialog, then write all products to an Excel file.
 *
 * @param {NormalizedProduct[]} products  already ranked
 * @param {string}              keyword
 * @returns {{ success: boolean, filePath?: string, reason?: string }}
 */
async function exportToExcel(products, keyword) {
  if (!products || products.length === 0) {
    return { success: false, reason: 'Aucun produit à exporter.' };
  }

  const safeName = (keyword || 'resultats').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  const defaultPath = path.join(os.homedir(), `findnest-${safeName}-${Date.now()}.xlsx`);

  const { filePath, canceled } = await dialog.showSaveDialog({
    title:       'Exporter les produits',
    defaultPath,
    filters:     [{ name: 'Excel', extensions: ['xlsx'] }],
  });

  if (canceled || !filePath) return { success: false, reason: 'Annulé par l\'utilisateur.' };

  const workbook  = new ExcelJS.Workbook();
  workbook.creator = 'FindNest App';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Produits');

  sheet.columns = [
    { header: 'Rang',             key: 'rank',             width: 6  },
    { header: 'Score',            key: 'score',            width: 8  },
    { header: 'Titre',            key: 'title',            width: 42 },
    { header: 'Prix (MAD)',       key: 'price',            width: 12 },
    { header: 'Ancien Prix',      key: 'oldPrice',         width: 12 },
    { header: 'Site',             key: 'website',          width: 12 },
    { header: 'Vendeur',          key: 'seller',           width: 20 },
    { header: 'Note',             key: 'rating',           width: 8  },
    { header: 'Avis',             key: 'reviewCount',      width: 8  },
    { header: 'Disponible',       key: 'availability',     width: 12 },
    { header: 'Livraison',        key: 'deliveryInfo',     width: 22 },
    { header: 'Localisation',     key: 'location',         width: 16 },
    { header: 'Explication Score', key: 'explanation',     width: 40 },
    { header: 'URL',              key: 'url',              width: 55 },
    { header: 'Extrait le',       key: 'scrapedAt',        width: 22 },
  ];

  // Styled header row
  const headerRow = sheet.getRow(1);
  headerRow.font  = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2288C8' } };
  headerRow.alignment = { horizontal: 'center' };

  products.forEach((p, i) => {
    const row = sheet.addRow({
      rank:        i + 1,
      score:       p.score,
      title:       p.title,
      price:       p.price,
      oldPrice:    p.oldPrice ?? '',
      website:     p.website,
      seller:      p.seller || '',
      rating:      p.rating ?? '',
      reviewCount: p.reviewCount ?? '',
      availability: p.availability ? 'Oui' : 'Non',
      deliveryInfo: p.deliveryInfo || '',
      location:    p.location || '',
      explanation: (p.scoreExplanation || []).join(' | '),
      url:         p.url,
      scrapedAt:   p.scrapedAt,
    });

    // Highlight winner row in gold
    if (i === 0) {
      row.font = { bold: true };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF176' } };
    }
  });

  // Freeze header row
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  await workbook.xlsx.writeFile(filePath);
  logger.info(`Exported ${products.length} products → ${filePath}`);
  return { success: true, filePath };
}

module.exports = { exportToExcel };
