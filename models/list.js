const DB = require('../util/database');

class IndexList {
  constructor(itemName) {
    if (!itemName) {
      throw Error('itemName is required');
    }

    this.itemName = itemName;
    this.items = this.loadList();
  }

  async loadList() {
    this.items = await DB.get(this.itemName, 'index') || [];
  }

  async saveList() {
    await DB.put(this.itemName, 'index', this.items);
  }

  async clearList() {
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

    await DB.put(this.itemName, 'index', this.items);
  }
}

module.exports = IndexList;
