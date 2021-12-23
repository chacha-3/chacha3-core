const { test } = require('tap');

const mock = require('../../util/mock');

const Wallet = require('../../models/wallet');
const Chain = require('../../models/chain');

const { SuccessCode, ErrorCode } = require('../../util/rpc');

const { runAction } = require('../../actions');

test('start and stop miner with address with status check', async (t) => {
  const receiver = new Wallet();
  await receiver.generate();

  Chain.mainChain = await mock.chainWithBlocks(3, 1);

  const startResponse = await runAction({
    action: 'startMiner',
    address: receiver.getAddressEncoded(),
  });

  t.equal(startResponse.code, SuccessCode);
  t.equal(startResponse.data.address, receiver.getAddressEncoded());

  const statusResponse = await runAction({
    action: 'minerStatus',
  });

  t.equal(statusResponse.code, SuccessCode);
  t.equal(statusResponse.data.isMining, true);
  t.equal(statusResponse.data.address, receiver.getAddressEncoded());

  const stopResponse = await runAction({
    action: 'stopMiner',
  });

  t.equal(stopResponse.code, SuccessCode);
  t.equal(stopResponse.data.address, receiver.getAddressEncoded());

  await Chain.clearMain();

  t.end();
});

test('start and stop miner with address of selected wallet', async (t) => {
  const [wallet] = await mock.createWallets(1);
  await Wallet.setSelected(wallet.getAddress());

  Chain.mainChain = await mock.chainWithBlocks(3, 1);

  const startResponse = await runAction({
    action: 'startMiner',
  });

  t.equal(startResponse.code, SuccessCode);
  t.equal(startResponse.data.address, wallet.getAddressEncoded());

  const stopResponse = await runAction({
    action: 'stopMiner',
  });

  t.equal(stopResponse.code, SuccessCode);
  t.equal(stopResponse.data.address, wallet.getAddressEncoded());

  await Wallet.clearAll();
  await Chain.clearMain();

  t.end();
});

test('correct miner status when miner not running', async (t) => {
  const receiver = new Wallet();
  await receiver.generate();

  Chain.mainChain = await mock.chainWithBlocks(3, 1);

  const { code, data } = await runAction({
    action: 'minerStatus',
  });

  t.equal(code, SuccessCode);
  t.equal(data.isMining, false);

  await Chain.clearMain();
  t.end();
});

test('should not start a miner that is already running', async (t) => {
  const receiver = new Wallet();
  await receiver.generate();

  Chain.mainChain = await mock.chainWithBlocks(3, 1);;

  // Start
  await runAction({
    action: 'startMiner',
    address: receiver.getAddressEncoded(),
  });

  // Duplicate start
  const { code } = await runAction({
    action: 'startMiner',
    address: receiver.getAddressEncoded(),
  });

  t.equal(code, ErrorCode.FailedPrecondition);

  // Stop
  await runAction({ action: 'stopMiner' });

  await Chain.clearMain();

  t.end();
});

test('should not stop a miner when it is not running', async (t) => {
  const receiver = new Wallet();
  await receiver.generate();

  Chain.mainChain = await mock.chainWithBlocks(3, 1);

  // Duplicate start
  const { code } = await runAction({
    action: 'stopMiner',
    address: receiver.getAddressEncoded(),
  });

  t.equal(code, ErrorCode.FailedPrecondition);

  await Chain.clearMain();

  t.end();
});
