const fs = require('fs');
const Block = require('../models/block');
const Transaction = require('../models/transaction');
const Wallet = require('../models/wallet');
const { deserializeBuffer } = require('../util/serialize');


// const minusCoinbase = numOfTransactions - 1;

//   const receiver = new Wallet();
//   receiver.generate();

//   const block = new Block();
//   block.addCoinbase(receiver.getAddressEncoded());
//   block.setPreviousHash(Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'));

//   for (let i = 0; i < minusCoinbase; i += 1) {
//     const sender = new Wallet();
//     sender.generate();

//     const transaction = new Transaction(
//       sender.getPublicKey(),
//       receiver.getAddressEncoded(),
//       Math.floor(Math.random() * (100 - 1) + 1),
//     );

//     transaction.sign(sender.getPrivateKeyObject());
//     block.addTransaction(transaction);
//   }

//   await block.mine();

//   return block;

const numOfBlocks = 10;
const transactionsPerBlock = 50;

// Coinbase receiver to send out
const sender = new Wallet();
sender.generate();

const generateBlocks = async () => {
  const blocksData = [];
  let previousHash = deserializeBuffer('0x0000000000000000000000000000000000000000000000000000000000000000');

  for (let i = 0; i < numOfBlocks; i += 1) {
    const receiver = new Wallet();
    receiver.generate();

    const block = new Block();
    block.addCoinbase(sender.getAddressEncoded());
    block.setPreviousHash(previousHash);

    const minusCoinbase = transactionsPerBlock - 1;
    for (let j = 0; j < minusCoinbase; j += 1) {
      const transaction = new Transaction(
        sender.getPublicKey(),
        receiver.getAddressEncoded(),
        Math.floor(Math.random() * (100 - 1) + 1),
      );

      transaction.sign(sender.getPrivateKeyObject());
      block.addTransaction(transaction);
    }

    await block.mine();
    previousHash = block.getHeader().getHash();
    blocksData.push(block.toObject());
  }

  return blocksData;
};
