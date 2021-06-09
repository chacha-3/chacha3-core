const level = require('level');

const db = level('data');

const DB = {};

DB.put = (itemName, itemId, value) => {
  const promise = db.put(`${itemName}_${itemId}`, value);
  return promise;
};

DB.get = (itemName, itemId) => {
  const promise = db.get(`${itemName}_${itemId}`);
  return promise;
};

DB.del = (itemName, itemId) => {
  const promise = db.del(`${itemName}_${itemId}`);
  return promise;
};

module.exports = DB;
