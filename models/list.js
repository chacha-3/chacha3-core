const DB = require('../util/database');

class IndexList {
  constructor(itemName) {
    if (!itemName) {
      throw Error('itemName is required');
    }

    this.itemName = itemName;
    this.items = [];
  }

  async loadItems() {
    this.items = await DB.get(this.itemName, 'index') || [];
  }

  async saveItems() {
    await DB.put(this.itemName, 'index', this.items);
  }

  async clearItems() {
    await DB.del(this.itemName, 'index');
    this.items = [];
  }

  async addItem(item) {
    this.items.push(item);

    if (this.items.indexOf(item) === -1) {
      this.items.push(item);
      await this.saveList();
    }
  }

  async removeItem(item) {
    const index = this.items.indexOf(item);

    if (index > -1) {
      this.items.splice(index, 1);
    }

    await DB.del(this.itemName, item);
    await this.saveItems();
  }

  getItems() {
    return this.items;
  }

  getSize() {
    return this.items.length;
  }
}

module.exports = IndexList;
