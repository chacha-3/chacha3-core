const fs = require('fs');
const jsonpack = require('jsonpack');
const BSON = require('bson');

const Block = require('../models/block');
const Transaction = require('../models/transaction');
const Wallet = require('../models/wallet');
const { deserializeBuffer } = require('../util/serialize');

const numOfTransactions = 2000;

// To determine storage required for block
async function main() {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const block = new Block();
  block.addCoinbase(receiver.getAddress(), 100000000000000000000000000000000n);

  for (let i = 0; i < numOfTransactions; i += 1) {
    const transaction = new Transaction(
      sender.getPublicKey(),
      receiver.getAddress(),
      10000000000n,
      Transaction.Type.Send,
    );
    await transaction.sign(sender.getPrivateKey());
    const result = block.addTransaction(transaction);
  }

  await block.mine();

  const obj = block.toObject();

  for (let y = 0; y < obj.transactions.length; y += 1) {
    // obj.transactions[y] = jsonpack.pack(obj.transactions[y]);
    // obj.transactions[y].receiverAddress = deserializeBuffer(obj.transactions[y].receiverAddress).toString('utf-8');

    // if (obj.transactions[y].signature) {
    //   obj.transactions[y].signature = deserializeBuffer(obj.transactions[y].signature).toString('utf-8');
    // }
  }

  await fs.writeFile('./scripts/output/block-size.json', BSON.serialize(obj), function (err) {
    if (err) return console.log(err);
  });
}

main().then(() => {
  // process.exit(1);
});
