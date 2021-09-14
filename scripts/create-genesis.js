const Block = require('../models/block');
const Transaction = require('../models/transaction');
const Wallet = require('../models/wallet');
const { deserializeBuffer } = require('../util/serialize');

const numOfBlocks = 10;
const transactionsPerBlock = 50;

// // Coinbase receiver to send out
// const sender = new Wallet();
// sender.generate();

let previousHash = deserializeBuffer('0x0000000000000000000000000000000000000000000000000000000000000000');

const receiver = new Wallet();
receiver.generate();

const block = new Block();
block.addCoinbase(receiver.getAddress());
block.setPreviousHash(previousHash);

block.mine().then(() => {
  console.log(block.toObject());
});
