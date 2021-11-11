const fs = require('fs');
const Block = require('../models/block');
const Transaction = require('../models/transaction');
const Wallet = require('../models/wallet');
const { deserializeBuffer } = require('../util/serialize');

const numOfBlocks = 10;
const transactionsPerBlock = 5;

// Coinbase receiver to send out
const sender = new Wallet();
sender.generate();

const generateBlocks = async () => {
  const blocksData = [Block.Genesis.toObject()];
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
        receiver.getAddress(),
        Math.floor(Math.random() * (100 - 1) + 1),
      );

      transaction.sign(sender.getPrivateKey());
      block.addTransaction(transaction);
    }

    await block.mine();
    previousHash = block.getHeader().getHash();
    blocksData.push(block.toObject());
  }

  return blocksData;
};

const main = async () => {
  const blocks = await generateBlocks();
  const data = JSON.stringify(blocks, null, 2);

  fs.writeFile('./scripts/output/test-chain.json', data, (err) => {
    if (err) {
        throw err;
    }
    console.log("JSON data is saved.");
  });
};



main();
