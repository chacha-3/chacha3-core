const wallet = {};

wallet.listAll = (request) => {
  console.log(request);

  return { data: 'response' };
};

module.exports = wallet;
