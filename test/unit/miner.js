const { test } = require('tap');
const Chain = require('../../models/chain');
// const chai = require('chai');

const Header = require('../../models/header');
const Miner = require('../../models/miner');
const mock = require('../../util/mock');

// const { expect } = chai;

test('start and stop miner', (t) => {
  const miner = new Miner();
  miner.setReceiverAddress('1F5jyjzkuNjZP6beKz81bsibdgCosRRCoy');

  t.equal(miner.isMining(), false);

  miner.start();

  t.equal(miner.isMining(), true);
  miner.stop();

  t.equal(miner.isMining(), false);
  t.end();
});

test('does not start miner when already running', async (t) => {
  const miner = new Miner();
  miner.setReceiverAddress('1F5jyjzkuNjZP6beKz81bsibdgCosRRCoy');

  const initialStart = miner.start();

  const startAgain = await miner.start();
  t.equal(startAgain, false);

  miner.stop();

  await initialStart.then((result) => {
    // Miner stopped
    t.equal(result, true);
    t.end();
  });
});