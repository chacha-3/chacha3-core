const { test } = require('tap');
const Chain = require('../../models/chain');

const Miner = require('../../models/miner');
const Wallet = require('../../models/wallet');
const mock = require('../../util/mock');

test('start and stop miner', async (t) => {
  Chain.mainChain = await Chain.load();

  const wallet = new Wallet();
  await wallet.generate();

  const miner = new Miner();
  miner.setReceiverAddress(wallet.getAddress());

  // FIXME: Fails when not assigned to variable
  const initialStart = miner.start();

  miner.stop();

  await initialStart.then(async (result) => {
    // Miner stopped
    t.equal(result, true);
  });

  await Chain.clearMain();
  t.end();
});

test('does not start miner when already running', async (t) => {
  Chain.mainChain = await Chain.load();

  const wallet = new Wallet();
  await wallet.generate();

  const miner = new Miner();
  miner.setReceiverAddress(wallet.getAddress());

  const initialStart = miner.start();

  const startAgain = await miner.start();
  t.equal(startAgain, false);

  miner.stop();

  await initialStart.then(async (result) => {
    // Miner stopped
    t.equal(result, true);

    await Chain.clearMain();
    t.end();
  });
});

test('mining worker finds meta', async (t) => {
  const block = await mock.blockWithTransactions(3);
  const header = block.getHeader();

  const miner = new Miner();

  let meta = null;

  try {
    meta = await miner.miningWorker(header, 10000);
    t.ok(meta !== null);
  } catch {
    t.equal(meta, null);
  }

  t.end();
});

test('check pause if chain is synching', async (t) => {
  Chain.mainChain = await Chain.load();
  Chain.mainChain.setSynching(true);

  const delay = 10;

  setTimeout(() => { Chain.mainChain.setSynching(false); }, delay);

  const start = performance.now();

  await Miner.pauseIfChainSynching();
  t.equal(Chain.mainChain.isSynching(), false);

  const end = performance.now();
  const time = end - start;

  t.ok(time >= delay);
  t.end();
});
