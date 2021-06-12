const chai = require('chai');
const chaiHttp = require('chai-http');

const Wallet = require('../../models/wallet');
const Block = require('../../models/block');

const { expect } = chai;

const build = require('../../app');

chai.use(chaiHttp);

describe('Index', () => {
  it('it should show index', (done) => {
    chai.request(build())
      .post('/')
      .end((err, res) => {
        console.log('hi');
        console.log(res);
        // expect(res).to.have.status(200);
        done();
      });
  });
});
