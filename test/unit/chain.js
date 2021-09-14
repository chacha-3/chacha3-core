const clone = require('rfdc')();
const { test } = require('tap');

const Wallet = require('../../models/wallet');
const Block = require('../../models/block');
const Chain = require('../../models/chain');

const mock = require('../../util/mock');

const blockData = require('../data/blocks.json');
const { generateAddressEncoded, generateAddress } = require('../../models/wallet');

test('create an empty chain', (t) => {
  const chain = new Chain();
  t.equal(chain.getLength(), 0, 'empty chain has height of 0');

  t.end();
});

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
  t.equal(Chain.isSynching(), false);

  Chain.setSynching(true);
  t.equal(Chain.isSynching(), true);

  t.end();
});


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

  await Chain.clear();
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

  await Chain.clear();
  t.end();
});

test('compare current chain with longer chain', async (t) => {
  const currentChain = await mock.chainWithHeaders(3, 5);

  // t.equal(result, 3);
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

    t.ok(senderBalance < 10000 * updatedBlocks);
    t.ok(receiverBalance > 0);
  }

  const senderBalance = chain.getAccountBalance(wallet.getAddressEncoded());

  const totalReceiverBalance = receiverAddresses.reduce(
    (total, value) => total + chain.getAccountBalance(value),
    0,
  );

  const totalSupply = 10000 * numOfBlocks;
  t.equal(senderBalance + totalReceiverBalance, totalSupply);
  t.end();
});

test('reverts transaction for invalid blocks block balances', async (t) => {
  const chain = new Chain();

  const [block1, block2] = await mock.blockList(2, 5);
  const result1 = chain.updateBlockBalances(block1);

  const initialState = { ...chain.accounts };

  // Tamper block, set value exceeding account balance
  block2.transactions[2].amount = 1000000;
  const result2 = chain.updateBlockBalances(block2);

  t.equal(result1, true, 'Successfully updated block balances');
  t.equal(result2, false, 'Invalid transaction. No update to block balance');

  const revertedState = { ...chain.accounts };
  t.equal(JSON.stringify(initialState), JSON.stringify(revertedState));

  t.end();
});

test('reverts transaction for invalid blocks block balances', async (t) => {
  const chain = new Chain();

  const [block1, block2] = await mock.blockList(2, 5);
  const result1 = chain.updateBlockBalances(block1);

  const initialState = { ...chain.accounts };

  // Tamper block, set value exceeding account balance
  block2.transactions[2].amount = 1000000;

  const result2 = chain.updateBlockBalances(block2);

  t.equal(result1, true, 'Successfully updated block balances');
  t.equal(result2, false, 'Invalid transaction. No update to block balance');

  const revertedState = { ...chain.accounts };
  t.equal(JSON.stringify(initialState), JSON.stringify(revertedState));

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

  t.not(JSON.stringify(initialState), JSON.stringify(updatedState));

  chain.revertBlockBalances(block2);

  const revertedState = { ...chain.accounts };
  t.equal(JSON.stringify(initialState), JSON.stringify(revertedState));

  t.end();
});

test('clear rejected blocks in chain', async (t) => {
  const numOfBlocks = 10;
  const chain = await mock.chainWithBlocks(numOfBlocks, 5);
  t.equal(chain.getLength(), 10);

  const clearedBlocks = await Chain.clearRejectedBlocks(chain, 6);
  t.equal(clearedBlocks.length, 4);

  await Chain.clear();
  t.end();
});

test('have zero balance for account without transaction', async (t) => {
  const chain = new Chain();

  const [block1] = await mock.blockList(1, 2);
  chain.updateBlockBalances(block1);

  const randomWallet = new Wallet();
  randomWallet.generate();

  t.equal(chain.getAccountBalance(randomWallet.getAddressEncoded()), 0);
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

test('verify genesis block', async (t) => {
  const chain = await mock.chainWithHeaders(2, 3);
  const verify = chain.verifyGenesisBlock();

  t.equal(verify, true);

  t.end();
});

test('invalid genesis block', async (t) => {
  const randomBlock = await mock.blockWithTransactions(2);

  const chain = new Chain();
  chain.addBlockHeader(randomBlock.getHeader());

  const verify = chain.verifyGenesisBlock();

  t.equal(verify, false);
  t.end();
});

test('block reward at index', async (t) => {
  t.equal(Chain.blockRewardAtIndex(0), 1048576);
  t.equal(Chain.blockRewardAtIndex(999), 1048576);
  t.equal(Chain.blockRewardAtIndex(1000), 524288);
  t.equal(Chain.blockRewardAtIndex(2000), 262144);
  t.equal(Chain.blockRewardAtIndex(3000), 131072);
  t.equal(Chain.blockRewardAtIndex(3999), 131072);
  t.equal(Chain.blockRewardAtIndex(4000), 65536);

  t.end();
});
