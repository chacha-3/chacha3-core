const { test } = require('tap');

const Wallet = require('../../models/wallet');
const Block = require('../../models/block');
const Chain = require('../../models/chain');

const mock = require('../../util/mock');

const { generateAddress } = require('../../models/wallet');
const { serializeObject, deserializeBuffer } = require('../../util/serialize');
const Transaction = require('../../models/transaction');

// test('create an empty chain', (t) => {
//   const chain = new Chain();
//   t.equal(chain.getLength(), 0, 'empty chain has height of 0');

//   t.end();
// });

test('add block headers to the chain', async (t) => {
  const numOfBlocks = 4;

  const chain = new Chain();
  chain.addBlockHeader(Block.Genesis.getHeader());

  const minusGenesis = numOfBlocks - 1;
  let previousBlock = Block.Genesis;

  const blocks = Array.from({ length: minusGenesis });

  for (let i = 0; i < minusGenesis; i += 1) {
    blocks[i] = await mock.blockWithTransactions(5, previousBlock);
    chain.addBlockHeader(blocks[i].getHeader());

    previousBlock = blocks[i];
  }

  const headers = chain.getBlockHeaders();
  t.ok(headers[0].getHash().equals(Block.Genesis.getHeader().getHash()));

  for (let i = 1; i < numOfBlocks; i += 1) {
    t.ok(headers[i].getHash().equals(blocks[i - 1].getHeader().getHash()));
  }

  t.equal(chain.getLength(), numOfBlocks, 'chain has correct length');
  t.end();
});

test('get total work in chain', async (t) => {
  const numOfBlocks = 4;

  const chain = await mock.chainWithHeaders(numOfBlocks, 5);
  t.equal(chain.getTotalWork(), 4);
  t.end();
});

test('set chain synching status', (t) => {
  t.equal(Chain.mainChain.isSynching(), false);

  Chain.mainChain.setSynching(true);
  t.equal(Chain.mainChain.isSynching(), true);

  t.end();
});

test('synchronize main chain with longer chain', async (t) => {
  const numOfBlocks = 4;

  const longerChain = await mock.chainWithHeaders(numOfBlocks, 3);
  t.equal(longerChain.getLength(), 4);

  const data = longerChain.toObject();
  data.blockHeaders = data.blockHeaders.slice(0, 2);

  Chain.mainChain = Chain.fromObject(data);
  // Chain.mainChain.

  t.end();
});


// TODO: Add after chain from array
// test('synchronize main chain with longer chain', (t) => {
//   t.equal(Chain.mainChain.isSynching(), false);

//   const numOfBlocks = 8;

//   const longerChain = await mock.chainWithBlocks(numOfBlocks, 4);

//   const currentChain = Chain.from
//   Chain.mainChain = await mock.chainWithBlocks(8, 4);

//   t.end();
// });

test('calculate average block time difference in chain', async (t) => {
  const numOfBlocks = 3;
  const chain = await mock.chainWithHeaders(numOfBlocks, 5);

  chain.blockHeaders[0].setTime(1628163920000);
  chain.blockHeaders[1].setTime(1628163940000);
  chain.blockHeaders[2].setTime(1628163980000);

  // Average difference in time between blocks
  // (20000 + 40000) / 2 = 30000
  t.equal(chain.getAverageBlockTime(), 30000);

  t.end();
});

test('no average block time when chain has only one block', async (t) => {
  const chain = await mock.chainWithHeaders(1, 3);

  t.equal(chain.getAverageBlockTime(), 0);
  t.end();
});

test('get correct difficulty', async (t) => {
  t.equal(Chain.getAdjustInterval(), 8);
  t.equal(Chain.getExpectedTimePerBlock(), 1000);

  const numOfBlocks = 20;
  const chain = await mock.chainWithHeaders(numOfBlocks, 3);

  const actualTimePerBlock = 600;

  for (let i = 0; i < numOfBlocks; i += 1) {
    chain.blockHeaders[i].setTime(1628163920000 + (actualTimePerBlock * i));
  }

  const numOfAdjustments = Math.floor(numOfBlocks / Chain.getAdjustInterval());
  const adjustFactor = Chain.calculateAdjustFactor(
    Chain.getExpectedTimePerBlock(),
    actualTimePerBlock,
  );

  t.equal(chain.getCurrentDifficulty(), adjustFactor ** numOfAdjustments);
  t.end();
});

test('get default difficulty when one or less blocks', async (t) => {
  const chain = await mock.chainWithHeaders(1, 2);

  t.equal(chain.getCurrentDifficulty(), 1.0);

  await Chain.clearMain();
  t.end();
});

test('load empty chain', async (t) => {
  const loaded = await Chain.load();

  // Only genesis block
  t.equal(loaded.getLength(), 1);
  t.end();
});

test('save and load chain', async (t) => {
  const numOfBlocks = 3;
  const chain = await mock.chainWithBlocks(numOfBlocks, 5);
  const { key } = await Chain.save(chain);
  t.equal(key, 'chain');

  const loaded = await Chain.load();

  t.equal(loaded.getLength(), numOfBlocks);
  t.ok(loaded.getBlockHeaders()[0].getHash().equals(chain.getBlockHeaders()[0].getHash()));

  await Chain.clearMain();
  t.end();
});

test('correct chain diverge index', async (t) => {
  const currentChain = await mock.chainWithHeaders(3, 5);
  const longerChain = await mock.chainWithHeaders(5, 5);

  const divergeIndex = currentChain.compareWork(longerChain);

  // Diverge after genesis block
  t.equal(divergeIndex, 1);
  t.end();
});

test('compare current chain with longer chain', async (t) => {
  const longerChain = await mock.chainWithHeaders(5, 5);

  // Export and slice data
  const exported = longerChain.toObject();
  exported.blockHeaders = exported.blockHeaders.slice(0, 3);

  const currentChain = Chain.fromObject(exported);
  const divergeIndex = currentChain.compareWork(longerChain);

  t.equal(divergeIndex, 3);
  t.end();
});

test('compare current chain with equal chain', async (t) => {
  const currentChain = await mock.chainWithHeaders(3, 5);
  const divergeIndex = currentChain.compareWork(currentChain);

  t.equal(divergeIndex, -1);
  t.end();
});

test('compare current chain with shorter chain', async (t) => {
  const currentChain = await mock.chainWithHeaders(5, 5);
  const shorterChain = await mock.chainWithHeaders(2, 5);

  const divergeIndex = currentChain.compareWork(shorterChain);

  t.equal(divergeIndex, -1);
  t.end();
});

test('update and reverts block balances', async (t) => {
  const chain = new Chain();

  const numOfBlocks = 2;

  // Coinbase wallet to send to
  const wallet = new Wallet();
  wallet.generate();

  const blocks = await mock.blockList(numOfBlocks, 2, wallet);
  const receiverAddresses = new Array(numOfBlocks);

  for (let i = 0; i < numOfBlocks; i += 1) {
    chain.updateBlockBalances(blocks[i]);

    // Post coinbase transaction
    const transaction = blocks[i].getTransaction(1);

    const senderAddress = generateAddress(transaction.getSenderKey());
    receiverAddresses[i] = transaction.getReceiverAddress();

    const senderBalance = chain.getAccountBalance(senderAddress);
    const receiverBalance = chain.getAccountBalance(receiverAddresses[i]);

    const updatedBlocks = i + 1;

    t.ok(senderBalance < Block.InitialReward * BigInt(updatedBlocks));
    t.ok(receiverBalance > 0);
  }

  const senderBalance = chain.getAccountBalance(wallet.getAddressEncoded());

  const totalReceiverBalance = receiverAddresses.reduce(
    (total, value) => BigInt(total) + chain.getAccountBalance(value),
    0,
  );

  const totalSupply = Block.InitialReward * BigInt(numOfBlocks);
  t.equal(senderBalance + totalReceiverBalance, totalSupply);
  t.end();
});

test('reverts transaction for invalid blocks block balances', async (t) => {
  const chain = new Chain();
  const numOfBlocks = 2;

  const [block1, block2] = await mock.blockList(numOfBlocks, 5);
  const result1 = chain.updateBlockBalances(block1);

  const initialState = { ...chain.accounts };

  // Tamper block, set value exceeding account balance
  block2.transactions[2].amount = (Block.InitialReward * BigInt(numOfBlocks)) + 10000n;

  const result2 = chain.updateBlockBalances(block2);

  t.equal(result1, true, 'Successfully updated block balances');
  t.equal(result2, false, 'Invalid transaction. No update to block balance');

  const revertedState = { ...chain.accounts };
  t.equal(
    JSON.stringify(serializeObject(initialState)),
    JSON.stringify(serializeObject(revertedState)),
  );

  t.end();
});

test('reverts transaction for invalid blocks block balances', async (t) => {
  const chain = new Chain();
  const numOfBlocks = 2;

  const [block1, block2] = await mock.blockList(numOfBlocks, 5);
  const result1 = chain.updateBlockBalances(block1);

  const initialState = { ...chain.accounts };

  // Tamper block, set value exceeding account balance
  block2.transactions[2].amount = (Block.InitialReward * BigInt(numOfBlocks)) + 100000n;

  const result2 = chain.updateBlockBalances(block2);

  t.equal(result1, true, 'Successfully updated block balances');
  t.equal(result2, false, 'Invalid transaction. No update to block balance');

  const revertedState = { ...chain.accounts };
  t.equal(
    JSON.stringify(serializeObject(initialState)),
    JSON.stringify(serializeObject(revertedState)),
  );

  t.end();
});

test('unable to update block balance when account has no balance', async (t) => {
  const chain = new Chain();

  const numOfBlocks = 2;

  // Coinbase wallet to send to
  const wallet = new Wallet();
  wallet.generate();

  // const blocks = await mock.blockList(numOfBlocks, 2, wallet);

  const noBalanceWallet = new Wallet();
  noBalanceWallet.generate();

  const noBalanceBlock = new Block();
  noBalanceBlock.setPreviousHash(deserializeBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'));
  noBalanceBlock.addCoinbase(wallet.getAddress());

  const transaction = new Transaction(noBalanceWallet.getPublicKey(), wallet.getAddress(), 10);
  transaction.sign(noBalanceWallet.getPrivateKey());

  noBalanceBlock.addTransaction(transaction);
  await noBalanceBlock.mine();

  const result = chain.updateBlockBalances(noBalanceBlock);
  t.equal(result, false);

  t.end();
});

test('reverts a specific valid transaction', async (t) => {
  const chain = new Chain();

  const [block1, block2] = await mock.blockList(2, 5);
  const result1 = chain.updateBlockBalances(block1);

  const initialState = { ...chain.accounts };
  const result2 = chain.updateBlockBalances(block2);

  t.equal(result1, true, 'Successfully update balance for block 1');
  t.equal(result2, true, 'Successfully update balance for block 2');

  const updatedState = { ...chain.accounts };

  t.not(
    JSON.stringify(serializeObject(initialState)),
    JSON.stringify(serializeObject(updatedState)),
  );

  chain.revertBlockBalances(block2);

  const revertedState = { ...chain.accounts };
  t.equal(
    JSON.stringify(serializeObject(initialState)),
    JSON.stringify(serializeObject(revertedState)),
  );

  t.end();
});

test('clear blocks in chain', async (t) => {
  const numOfBlocks = 12;

  const chain = await mock.chainWithBlocks(numOfBlocks, 5);
  t.equal(chain.getLength(), numOfBlocks);

  const forkIndex = 8;

  const clearId = chain.getBlockHeader(forkIndex + 1).getHash();
  const nonClearId = chain.getBlockHeader(forkIndex - 1).getHash();

  const clearedBlocks = await chain.clearBlocks(forkIndex);
  t.equal(clearedBlocks.length, numOfBlocks - forkIndex);

  const clearedBlock = await Block.load(clearId);
  const nonClearedBlock = await Block.load(nonClearId);

  t.equal(clearedBlock, null);
  t.ok(nonClearedBlock.getHeader().getHash().equals(nonClearId));

  await Chain.clearMain();
  t.end();
});

test('have zero balance for account without transaction', async (t) => {
  const chain = new Chain();

  const [block1] = await mock.blockList(1, 2);
  chain.updateBlockBalances(block1);

  const randomWallet = new Wallet();
  randomWallet.generate();

  t.equal(chain.getAccountBalance(randomWallet.getAddressEncoded()), 0n);
  const transactions = chain.getAccountTransactions(randomWallet.getAddress());

  t.ok(Array.isArray(transactions));
  t.equal(transactions.length, 0);

  t.end();
});

test('list correct account transactions from chain', async (t) => {
  const chain = new Chain();

  const numOfBlocks = 2;
  const transactionsPerBlock = 2;

  // Coinbase wallet to send to
  const wallet = new Wallet();
  wallet.generate();

  const blocks = await mock.blockList(numOfBlocks, transactionsPerBlock, wallet);

  const receiverAddresses = new Array(numOfBlocks);

  for (let i = 0; i < numOfBlocks; i += 1) {
    chain.updateBlockBalances(blocks[i]);

    // Post coinbase transaction
    const transaction = blocks[i].getTransaction(1);

    // const senderAddress = generateAddressEncoded(transaction.getSenderKey());
    receiverAddresses[i] = transaction.getReceiverAddress();

    // const senderBalance = chain.getAccountBalance(senderAddress);
    // const receiverBalance = chain.getAccountBalance(receiverAddresses[i]);

    // const updatedBlocks = i + 1;

    // t.ok(senderBalance < 10000 * updatedBlocks);
    // t.ok(receiverBalance > 0);
  }

  for (let j = 0; j < numOfBlocks; j += 1) {
    t.equal(chain.getAccountTransactions(receiverAddresses[j]).length, 1);
  }

  const senderTransactions = chain.getAccountTransactions(wallet.getAddress());

  t.equal(senderTransactions.length, 4);
  t.equal(typeof (senderTransactions[0]), 'string');
});

test('to and from object', async (t) => {
  const chain = await mock.chainWithHeaders(3, 5);

  const obj = chain.toObject();
  t.equal(obj.blockHeaders.length, 3);

  const loaded = Chain.fromObject(obj);
  t.equal(loaded.blockHeaders.length, 3);

  t.end();
});

test('verify chain', async (t) => {
  const chain = await mock.chainWithBlocks(12, 3);

  const verified = await chain.verify();
  t.equal(verified, true);

  await Chain.clearMain();
  t.end();
});

test('unable to verify chain with different genesis block', async (t) => {
  const chain = await mock.chainWithBlocks(12, 3);

  const verified = await chain.verify();
  t.equal(verified, true);

  await Chain.clearMain();
  t.end();
});

// test('unable to verify chain with invalid block balance', async (t) => {
//   const numOfBlocks = 12;

//   const sender = new Wallet();
//   sender.generate();

//   const receiver = new Wallet();
//   receiver.generate();

//   const chain = await mock.chainWithBlocks(numOfBlocks, 3);

//   const blockReward = Chain.blockRewardAtIndex(numOfBlocks);

//   const block = new Block();
//   block.addCoinbase(sender, Chain.blockRewardAtIndex(numOfBlocks));

//   const exceedBalance = blockReward * 2n;

//   const invalidBalanceTransaction = new Transaction(
//     sender.getPublicKey(),
//     receiver.getAddress(),
//     exceedBalance,
//   );

//   invalidBalanceTransaction.sign(sender.getPrivateKey());

//   block.addTransaction(invalidBalanceTransaction);
//   await block.mine();

//   // // Inject invalid block to chain
//   // chain.addBlockHeader(block.getHeader());
//   // await block.save();

//   // const verified = await chain.verify();
//   // t.equal(verified, false);

//   await chain.clearBlocks();
//   await Chain.clearMain();
//   t.end();
// });

// TODO:
test('fail to verify chain if genesis block does not match chain', async (t) => {
  const chain = await mock.chainWithBlocks(12, 3);

  const verified = await chain.verify();
  t.equal(verified, true);

  await Chain.clearMain();
  t.end();
});

// FIXME: Does not check anything
// test('chain with invalid block reward fails verification', async (t) => {
//   const wallet = new Wallet();
//   wallet.generate();

//   const chain = await mock.chainWithBlocks(Chain.getHalvingInterval() + 1, 3);

//   // Reward should have halved
//   const wrongReward = Block.InitialReward;

//   const invalidBlock = new Block();
//   invalidBlock.addCoinbase(wallet.getAddress(), wrongReward);
//   invalidBlock.setPreviousHash(chain.lastBlockHeader().getHash());

//   await invalidBlock.mine();

//   // await invalidBlock.mine();

//   // const verified = await chain.verify();
//   // t.equal(verified, true);

//   await Chain.clearMain();
//   t.end();
// });

test('verify genesis block', async (t) => {
  const chain = await mock.chainWithHeaders(2, 3);
  const verify = chain.verifyGenesisBlock();

  t.equal(verify, true);

  t.end();
});

// FIXME:
// test('invalid genesis block', async (t) => {
//   const randomBlock = await mock.blockWithTransactions(2);

//   const chain = new Chain();
//   chain.addBlockHeader(randomBlock.getHeader());

//   const verify = chain.verifyGenesisBlock();

//   t.equal(verify, false);
//   t.end();
// });

test('block reward at index', async (t) => {
  t.equal(Chain.blockRewardAtIndex(0), Block.InitialReward);
  t.equal(Chain.blockRewardAtIndex(Chain.getHalvingInterval() - 1), Block.InitialReward);
  t.equal(Chain.blockRewardAtIndex(Chain.getHalvingInterval()), Block.InitialReward / 2n);
  t.equal(Chain.blockRewardAtIndex(Chain.getHalvingInterval() * 2), Block.InitialReward / 4n);
  t.equal(Chain.blockRewardAtIndex(Chain.getHalvingInterval() * 3), Block.InitialReward / 8n);
  t.equal(Chain.blockRewardAtIndex(Chain.getHalvingInterval() * 4 - 1), Block.InitialReward / 8n);
  t.equal(Chain.blockRewardAtIndex(Chain.getHalvingInterval() * 4), Block.InitialReward / 16n);

  t.end();
});

// test('chain current reward', async (t) => {
//   const numOfBlocks = Chain.getHalvingInterval();
//   const chain = await mock.chainWithBlocks(numOfBlocks, 3);

//   t.equal(chain.currentBlockReward(), Block.InitialReward);

//   t.end();
// });

test('confirm new valid block', async (t) => {
  Chain.mainChain = await mock.chainWithBlocks(6, 3);

  const wallet = new Wallet();
  wallet.generate();

  const block = new Block();

  block.addCoinbase(wallet.getAddress());
  block.setPreviousHash(Chain.mainChain.lastBlockHeader().getHash());

  await block.mine();

  const confirm = await Chain.mainChain.confirmNewBlock(block);

  t.equal(confirm, true);

  await Chain.clearMain();
  t.end();
});
