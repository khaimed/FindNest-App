const { randomUUID } = require('crypto');

class ProductStore {
  constructor() {
    this._products = new Map();
    this.currentKeyword = '';
  }

  newSearch(keyword) {
    this._products.clear();
    this.currentKeyword = keyword;
  }

  add(product) {
    const id = product.id || randomUUID();
    const stored = { ...product, id };
    this._products.set(id, stored);
    return stored;
  }

  addMany(products) {
    return products.map(p => this.add(p));
  }

  getAll() {
    return Array.from(this._products.values());
  }

  clear() {
    this._products.clear();
  }

  get size() {
    return this._products.size;
  }
}

// Singleton: one store per app session
module.exports = new ProductStore();
