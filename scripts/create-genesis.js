const Block = require('../models/block');
const Transaction = require('../models/transaction');
const Wallet = require('../models/wallet');

const numOfBlocks = 10;
const transactionsPerBlock = 50;

// // Coinbase receiver to send out
// const sender = new Wallet();
// sender.generate();

let previousHash = Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex');

const receiver = new Wallet();
receiver.generate();

const block = new Block();
block.addCoinbase(receiver.getAddressEncoded());
block.setPreviousHash(previousHash);

block.mine().then(() => {
  console.log(block.toObject());
});

// console.log(block);