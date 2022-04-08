const crypto = require('crypto');
const { test } = require('tap');

const Wallet = require('../../models/wallet');
const Block = require('../../models/block');
const Header = require('../../models/block');
const Chain = require('../../models/chain');
const Transaction = require('../../models/transaction');

const mock = require('../../util/mock');

const { Production, Staging, Testing } = require('../../util/env').Env;
const { serializeObject, serializeBuffer } = require('../../util/serialize');

test('new chain only has genesis', (t) => {
  const chain = new Chain();
  t.equal(chain.getLength(), 1);

  t.end();
});

test('add block headers to the chain', async (t) => {
  const numOfBlocks = 4;

  const chain = new Chain();

  const minusGenesis = numOfBlocks - 1;
  let previousBlock = Block.Genesis;

  const blocks = Array.from({ length: minusGenesis });

  for (let i = 0; i < minusGenesis; i += 1) {
    blocks[i] = await mock.blockWithTransactions(5, previousBlock);

    const added = chain.addBlockHeader(blocks[i].getHeader());
    t.equal(added, true);

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

test('does not add block header that does not match current difficulty to chain', async (t) => {
  // Enough blocks to have the difficulty adjusted
  const numOfBlocks = Chain.getAdjustInterval() + 1;

  const chain = await mock.chainWithBlocks(numOfBlocks, 3);
  t.equal(chain.getLength(), numOfBlocks, 'chain has correct initial length');
  t.ok(chain.getCurrentDifficulty() > 1, 'chain has increased difficulty past adjust interval');

  const block = await mock.blockWithTransactions(2, Block.Genesis);
  block.header.setDifficulty(1);

  const added = chain.addBlockHeader(block.getHeader());
  t.equal(added, false);

  t.equal(chain.getLength(), numOfBlocks, 'no change to chain length');
  t.end();
});

// TODO: Remove. Validation moved elsewhere
// test('does not added block header to chain when previous hash does not match', async (t) => {
//   const chain = new Chain();

//   const block = await mock.blockWithTransactions(3, Block.Genesis);

//   // Set incorrect previous hash
//   block.header.previous = crypto.randomBytes(32);

//   const added = chain.addBlockHeader(block.getHeader());
//   t.equal(added, false, 'does not add block with incorrect previous hash');
//   t.equal(chain.getLength(), 1, 'no change to chain length');

//   t.end();
// });

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
  const { key } = await chain.save();
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
  await wallet.generate();

  const blocks = await mock.blockList(numOfBlocks, 2, wallet, 5n);
  const receiverAddresses = new Array(numOfBlocks);

  for (let i = 0; i < numOfBlocks; i += 1) {
    chain.updateBlockBalances(blocks[i]);

    // Post coinbase transaction
    const transaction = blocks[i].getTransaction(1);

    const senderAddress = Wallet.generateAddress(transaction.getSenderKey());
    receiverAddresses[i] = transaction.getReceiverAddress();

    const senderBalance = chain.getAccountBalance(senderAddress);
    const receiverBalance = chain.getAccountBalance(receiverAddresses[i]);

    const updatedBlocks = i + 1;

    // FIXME: Mining own transaction. Sender fee goes back to miner.
    // Write test with separate miner and sender
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

  // Coinbase wallet to send to
  const wallet = new Wallet();
  await wallet.generate();

  // const blocks = await mock.blockList(numOfBlocks, 2, wallet);

  const noBalanceWallet = new Wallet();
  await noBalanceWallet.generate();

  const noBalanceBlock = new Block();
  noBalanceBlock.addCoinbase(wallet.getAddress());

  const transaction = new Transaction(noBalanceWallet.getPublicKey(), wallet.getAddress(), 10);
  await transaction.sign(noBalanceWallet.getPrivateKey());

  noBalanceBlock.addTransaction(transaction);
  await noBalanceBlock.mine(1);

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

test('clear blocks in chain starting from index', async (t) => {
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

test('clear main chain data', async (t) => {
  const numOfBlocks = 12;

  Chain.mainChain = await mock.chainWithBlocks(numOfBlocks, 5);
  t.equal(Chain.mainChain.getLength(), numOfBlocks);

  const header = Chain.mainChain.lastBlockHeader();
  const clearedBlock = await Block.load(header.getHash());

  t.not(await Header.load(clearedBlock.getHeader().getHash()), null);
  t.not(await Transaction.load(clearedBlock.getTransaction(0).getId()), null);

  await Chain.clearMain();
  t.equal(Chain.mainChain.getLength(), 1);

  t.equal(await Header.load(clearedBlock.getHeader().getHash()), null);
  t.equal(await Transaction.load(clearedBlock.getTransaction(0).getId()), null);

  t.end();
});

test('have zero balance for account without transaction', async (t) => {
  const chain = new Chain();

  const [block1] = await mock.blockList(1, 2);
  chain.updateBlockBalances(block1);

  const randomWallet = new Wallet();
  await randomWallet.generate();

  t.equal(chain.getAccountBalance(randomWallet.getAddressEncoded()), 0n);
  const transactions = chain.getAccountTransactions(randomWallet.getAddress());

  t.ok(Array.isArray(transactions));
  t.equal(transactions.length, 0);

  t.end();
});

test('list correct account transactions from chain (no fee)', async (t) => {
  const chain = new Chain();

  const numOfBlocks = 2;
  const transactionsPerBlock = 2;

  // Coinbase wallet to send to
  const wallet = new Wallet();
  await wallet.generate();

  const blocks = await mock.blockList(numOfBlocks, transactionsPerBlock, wallet);

  const receiverAddresses = new Array(numOfBlocks);

  for (let i = 0; i < numOfBlocks; i += 1) {
    chain.updateBlockBalances(blocks[i]);

    // Post coinbase transaction
    const transaction = blocks[i].getTransaction(1);
    receiverAddresses[i] = transaction.getReceiverAddress();
  }

  for (let j = 0; j < numOfBlocks; j += 1) {
    t.equal(chain.getAccountTransactions(receiverAddresses[j]).length, 1);
  }

  const senderTransactions = chain.getAccountTransactions(wallet.getAddress());

  t.equal(senderTransactions.filter((transaction) => transaction.action === 'mine').length, 2);
  t.equal(senderTransactions.filter((transaction) => transaction.action === 'send').length, 2);
});

test('list correct account transactions from chain (with fee)', async (t) => {
  const chain = new Chain();

  const numOfBlocks = 2;
  const transactionsPerBlock = 2;

  // Coinbase wallet to send to
  const wallet = new Wallet();
  await wallet.generate();

  const blocks = await mock.blockList(numOfBlocks, transactionsPerBlock, wallet, 5n);
  const receiverAddresses = new Array(numOfBlocks);

  for (let i = 0; i < numOfBlocks; i += 1) {
    chain.updateBlockBalances(blocks[i]);

    // Post coinbase transaction
    const transaction = blocks[i].getTransaction(1);

    receiverAddresses[i] = transaction.getReceiverAddress();
  }

  for (let j = 0; j < numOfBlocks; j += 1) {
    t.equal(chain.getAccountTransactions(receiverAddresses[j]).length, 1);
  }

  const senderTransactions = chain.getAccountTransactions(wallet.getAddress());

  t.equal(senderTransactions.filter((transaction) => transaction.action === 'mine').length, 2);
  t.equal(senderTransactions.filter((transaction) => transaction.action === 'send').length, 2);
  t.equal(senderTransactions.filter((transaction) => transaction.action === 'fee').length, 2);
});

test('to and from object', async (t) => {
  const chain = await mock.chainWithHeaders(3, 5);

  const obj = chain.toObject();
  t.equal(obj.blockHeaders.length, 3);

  const loaded = Chain.fromObject(obj);
  t.equal(loaded.blockHeaders.length, 3);

  t.end();
});

test('chain is unverified after adding block header', async (t) => {
  Chain.mainChain = await mock.chainWithBlocks(3, 3);
  t.equal(Chain.mainChain.isVerified(), true);

  await Chain.clearMain();
  t.end();
});

test('verify chain balances', async (t) => {
  Chain.mainChain = await mock.chainWithBlocks(6, 3);

  const chain = Chain.fromObject(Chain.mainChain.toObject());
  t.equal(chain.isVerified(), false);

  await chain.loadBalances();
  t.equal(chain.isVerified(), true);

  await Chain.clearMain();
  t.end();
});

test('verify genesis block', async (t) => {
  const chain = await mock.chainWithHeaders(2, 3);
  const verify = chain.verifyGenesisBlock();

  t.equal(verify, true);

  t.end();
});

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
  const numOfBlocks = 6;

  Chain.mainChain = await mock.chainWithBlocks(numOfBlocks, 3);
  t.equal(Chain.mainChain.getLength(), numOfBlocks);

  const wallet = new Wallet();
  await wallet.generate();

  const block = new Block();

  block.addCoinbase(wallet.getAddress());
  block.setPreviousHash(Chain.mainChain.lastBlockHeader().getHash());

  await block.mine(Chain.mainChain.getCurrentDifficulty());

  const confirm = await Chain.mainChain.confirmNewBlock(block);
  t.equal(confirm, true);

  t.equal(Chain.mainChain.getLength(), numOfBlocks + 1);

  await Chain.clearMain();
  t.end();
});

test('fail to confirm new block if previous hash does not match', async (t) => {
  const numOfBlocks = 6;

  Chain.mainChain = await mock.chainWithBlocks(numOfBlocks, 3);
  t.equal(Chain.mainChain.getLength(), numOfBlocks);

  const wallet = new Wallet();
  await wallet.generate();

  const block = new Block();

  block.addCoinbase(wallet.getAddress(), Chain.blockRewardAtIndex(numOfBlocks - 1));
  block.setPreviousHash(crypto.randomBytes(32));

  await block.mine(Chain.mainChain.getCurrentDifficulty());

  const confirm = await Chain.mainChain.confirmNewBlock(block);
  t.equal(confirm, false);

  // No changes to main chain if unable to confirm new block
  t.equal(Chain.mainChain.getLength(), numOfBlocks);

  await Chain.clearMain();
  t.end();
});

test('update account correctly with coinbase transaction', async (t) => {
  Chain.mainChain = new Chain();
  t.equal(Object.keys(Chain.mainChain.accounts).length, 0);

  const blockReward = Chain.blockRewardAtIndex(1);

  const wallet = new Wallet();
  await wallet.generate();

  const block = new Block();
  block.addCoinbase(wallet.getAddress(), blockReward);

  const coinbaseTransaction = block.getCoinbaseTransaction();

  const result = Chain.mainChain.transactionUpdate(coinbaseTransaction, null);
  t.equal(result, true);

  const balance = Chain.mainChain.getAccountBalance(wallet.getAddress());
  t.ok(balance === blockReward);

  const transactions = Chain.mainChain.getAccountTransactions(wallet.getAddress());

  t.equal(transactions.length, 1);
  t.equal(transactions[0].action, 'mine');

  await Chain.clearMain();
  t.end();
});

test('revert account correctly with coinbase transaction', async (t) => {
  Chain.mainChain = new Chain();
  t.equal(Object.keys(Chain.mainChain.accounts).length, 0);

  const blockReward = Chain.blockRewardAtIndex(1);

  const wallet = new Wallet();
  await wallet.generate();

  const block = new Block();
  block.addCoinbase(wallet.getAddress(), blockReward);

  const coinbaseTransaction = block.getCoinbaseTransaction();

  // Before revert
  t.equal(Chain.mainChain.getAccountData(wallet.getAddress()), null);
  t.equal(Chain.mainChain.getAccountBalance(wallet.getAddress()), 0n);
  t.equal(Chain.mainChain.getAccountTransactions(wallet.getAddress()).length, 0);

  Chain.mainChain.transactionUpdate(coinbaseTransaction, null);
  Chain.mainChain.transactionRevert(coinbaseTransaction, null);

  // After revert
  t.equal(Chain.mainChain.getAccountData(wallet.getAddress()), null);
  t.equal(Chain.mainChain.getAccountBalance(wallet.getAddress()), 0n);
  t.equal(Chain.mainChain.getAccountTransactions(wallet.getAddress()).length, 0);

  await Chain.clearMain();
  t.end();
});

test('update account correctly with non-coinbase transaction', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  // Set sender as miner so that sender has balance to send
  Chain.mainChain = await mock.chainWithBlocks(2, 1, sender);

  // Third block
  const blockReward = Chain.blockRewardAtIndex(2);

  // Miner for new block, not the initial sender
  const miner = new Wallet();
  await miner.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const block = new Block();
  block.addCoinbase(miner.getAddress(), blockReward);

  const fee = 1000000n;
  const sendAmount = 1000000000n;

  const transactionWithFee = new Transaction(
    sender.getPublicKey(),
    receiver.getAddress(),
    sendAmount,
    Transaction.Type.Send,
  );

  transactionWithFee.setFee(fee);
  await transactionWithFee.sign(sender.getPrivateKey());

  block.addTransaction(transactionWithFee);

  const result = Chain.mainChain.transactionUpdate(transactionWithFee, miner.getAddress());
  t.equal(result, true);

  // Miner account
  const minerBalance = Chain.mainChain.getAccountBalance(miner.getAddress());
  const minerTransactions = Chain.mainChain.getAccountTransactions(miner.getAddress());
  t.ok(minerBalance === fee);
  t.equal(minerTransactions.length, 1);
  t.equal(minerTransactions[0].id, serializeBuffer(transactionWithFee.getId()));
  t.equal(minerTransactions[0].action, 'fee');

  // Sender account
  const senderBalance = Chain.mainChain.getAccountBalance(sender.getAddress());
  const senderTransactions = Chain.mainChain.getAccountTransactions(sender.getAddress());

  t.ok(senderBalance === Chain.blockRewardAtIndex(2) - sendAmount - fee);

  t.equal(senderTransactions.length, 2);
  t.equal(senderTransactions[1].id, serializeBuffer(transactionWithFee.getId()));
  t.equal(senderTransactions[1].action, 'send');

  // Receiver account
  const receiverBalance = Chain.mainChain.getAccountBalance(receiver.getAddress());
  const receiverTransactions = Chain.mainChain.getAccountTransactions(receiver.getAddress());

  t.ok(receiverBalance === sendAmount);

  t.equal(receiverTransactions.length, 1);
  t.equal(receiverTransactions[0].id, serializeBuffer(transactionWithFee.getId()));
  t.equal(receiverTransactions[0].action, 'receive');

  await Chain.clearMain();
  t.end();
});

test('revert account correctly with non-coinbase transaction', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  // Set sender as miner so that sender has balance to send
  Chain.mainChain = await mock.chainWithBlocks(2, 1, sender);

  // Third block
  const blockReward = Chain.blockRewardAtIndex(2);

  // Miner for new block, not the initial sender
  const miner = new Wallet();
  await miner.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const block = new Block();
  block.addCoinbase(miner.getAddress(), blockReward);

  const fee = 1000000n;

  const transactionWithFee = new Transaction(
    sender.getPublicKey(),
    receiver.getAddress(),
    1000000000n,
    Transaction.Type.Send,
  );

  transactionWithFee.setFee(fee);
  await transactionWithFee.sign(sender.getPrivateKey());

  block.addTransaction(transactionWithFee);

  // Before transaction update
  t.ok(Chain.mainChain.getAccountBalance(sender.getAddress()) === blockReward);
  t.equal(Object.keys(Chain.mainChain.accounts).length, 2);
  t.equal(Chain.mainChain.getAccountTransactions(sender.getAddress()).length, 1);
  t.equal(Chain.mainChain.getAccountTransactions(receiver.getAddress).length, 0);
  t.equal(Chain.mainChain.getAccountTransactions(miner.getAddress()).length, 0);

  Chain.mainChain.transactionUpdate(transactionWithFee, miner.getAddress());
  Chain.mainChain.transactionRevert(transactionWithFee, miner.getAddress());

  // After transaction revert
  t.ok(Chain.mainChain.getAccountBalance(sender.getAddress()) === blockReward);
  t.equal(Object.keys(Chain.mainChain.accounts).length, 2);
  t.equal(Chain.mainChain.getAccountTransactions(sender.getAddress()).length, 1);
  t.equal(Chain.mainChain.getAccountTransactions(receiver.getAddress()).length, 0);
  t.equal(Chain.mainChain.getAccountTransactions(miner.getAddress()).length, 0);

  await Chain.clearMain();
  t.end();
});

test('header verification fail when timestamp is not sequential (overlap)', async (t) => {
  const chain = await mock.chainWithHeaders(5, 3);
  t.equal(chain.verifyHeaders(), true);

  chain.blockHeaders[4].time = chain.blockHeaders[3].time - 100;
  t.equal(chain.verifyHeaders(), false);
  t.end();
});

test('clone a loaded chain', async (t) => {
  Chain.mainChain = await mock.chainWithBlocks(5, 3);
  t.equal(Chain.mainChain.isVerified(), true);

  const clone = Chain.mainChain.clone();
  t.equal(clone.isVerified(), false);

  await clone.loadBalances();
  t.equal(clone.isVerified(), true);

  t.equal(clone.getLength(), Chain.mainChain.getLength());

  t.equal(
    Object.keys(Chain.mainChain.getBlockHeaders()).length,
    Object.keys(clone.getBlockHeaders()).length,
  );

  await Chain.clearMain();

  t.end();
});

test('clone part of chain', async (t) => {
  Chain.mainChain = await mock.chainWithBlocks(5, 3);
  t.equal(Chain.mainChain.isVerified(), true);

  const clone = Chain.mainChain.clone(0, 3);
  t.equal(clone.isVerified(), false);

  await clone.loadBalances();
  t.equal(clone.isVerified(), true);

  t.equal(clone.getLength(), 3);

  await Chain.clearMain();

  t.end();
});

test('has halving interval of 1000000', async (t) => {
  t.equal(Chain.getHalvingInterval(Production), 1000000);
  t.equal(Chain.getHalvingInterval(Staging), 1000000);
  t.equal(Chain.getHalvingInterval(Testing), 10);

  t.end();
});

test('has adjust interval of 1440', async (t) => {
  t.equal(Chain.getAdjustInterval(Production), 1440);
  t.equal(Chain.getAdjustInterval(Staging), 1440);
  t.equal(Chain.getAdjustInterval(Testing), 8);

  t.end();
});

test('has expected time per block of 1 minute', async (t) => {
  t.equal(Chain.getExpectedTimePerBlock(Production), 60000);
  t.equal(Chain.getExpectedTimePerBlock(Staging), 60000);
  t.equal(Chain.getExpectedTimePerBlock(Testing), 1000);

  t.end();
});
