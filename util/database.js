const level = require('level');

const db = level('data');

const DB = {};

DB.put = (itemName, itemId, value) => {
  const data = (typeof value === 'object') ? JSON.stringify(value) : value;

  const result = db.put(`${itemName}_${itemId}`, data);
  return result;
};

DB.get = async (itemName, itemId) => {
  let result;

  try {
    result = await db.get(`${itemName}_${itemId}`);
  } catch (e) {
    result = null;
  }

  let data;

  try {
    data = JSON.parse(result);
  } catch (e) {
    return result;
  }

  return data;
};

DB.del = async (itemName, itemId) => {
  const result = await db.del(`${itemName}_${itemId}`);
  return result;
};

// DB.index = async (itemName) => {
//   const existing = await DB.get(itemName, 'index');
//   return existing || [];
// };

// DB.addIndex = async (itemName, itemId) => {
//   const list = await DB.index(itemName);
//   console.log(list.length);
//   if (list.indexOf(itemId) === -1) {
//     list.push(itemId);
//   }

//   console.log(`Add index ${itemId}`);
//   await DB.put(itemName, 'index', list);
// };

// DB.removeIndex = async (itemName, itemId) => {
//   const list = await DB.index(itemName);
//   const index = list.indexOf(itemId);

//   if (index > -1) {
//     list.splice(index, 1);
//   }

//   await DB.put(itemName, 'index', JSON.stringify(list));
// };

module.exports = DB;
