const { test } = require('tap');
const Chain = require('../../models/chain');
// const chai = require('chai');

const Header = require('../../models/header');
const Miner = require('../../models/miner');
const mock = require('../../util/mock');
const { deserializeBuffer } = require('../../util/serialize');

// const { expect } = chai;

// test('start and stop miner', async (t) => {
//   Chain.mainChain = await Chain.load();

//   const miner = new Miner();
//   miner.setReceiverAddress(deserializeBuffer('0x003a5e292ca07ae3490e6d56fcb8516abca32d197392b7bafcF'));

//   t.equal(miner.isMining(), false);

//   miner.start();

//   t.equal(miner.isMining(), true);
//   miner.stop();

//   t.equal(miner.isMining(), false);

//   await Chain.clearMain();
//   t.end();
// });

test('start and stop miner', async (t) => {
  Chain.mainChain = await Chain.load();

  const miner = new Miner();
  miner.setReceiverAddress(deserializeBuffer('0x003a5e292ca07ae3490e6d56fcb8516abca32d197392b7bafcF'));

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

  const miner = new Miner();
  miner.setReceiverAddress(deserializeBuffer('0x003a5e292ca07ae3490e6d56fcb8516abca32d197392b7bafcF'));

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
