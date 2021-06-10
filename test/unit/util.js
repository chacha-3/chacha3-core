const chai = require('chai');
const dirtyChai = require('dirty-chai');
const { del } = require('../../util/database');

const DB = require('../../util/database');

const { expect } = chai;
chai.use(dirtyChai);

describe('Util', () => {
  describe('Database', () => {
    it('should read, write, and delete data', async () => {
      const itemName = 'block';
      const itemId = '100';

      await DB.put(itemName, itemId, 'pop rock');

      const value = await DB.get(itemName, itemId);
      expect(value).to.be.equal('pop rock');

      await DB.del(itemName, itemId);

      let deleted = false;

      try {
        await DB.get(itemName, itemId);
      } catch (e) {
        deleted = true;
      }

      expect(deleted).to.be.true();
    });
    it('should throw an error when not found', async () => {
      const itemName = 'error';
      const itemId = '100';

      let readError = false;

      try {
        await DB.get(itemName, itemId);
      } catch (e) {
        expect(e.name).to.be.equal('NotFoundError');
        readError = true;
      }

      expect(readError).to.be.true();
    });
  });
});
