const assert = require('assert');

const Block = require('../models/block');
const Wallet = require('../models/wallet');
const { deserializeBuffer } = require('../util/serialize');

const receiver = new Wallet();
receiver.generate().then(() => {
  const block = new Block();
  block.addCoinbase(receiver.getAddress());

  block.mine().then(() => {
    console.log(block.toObject());
  });
});
