const wallet = {};

wallet.listWallets = (request) => {
  console.log(request);

  return { data: 'response' };
};

module.exports = wallet;
