const {
  createECDH,
} = require('crypto');

// Generate Alice's keys...
const alice = createECDH('secp521r1');
const aliceKey = alice.generateKeys();
console.log(aliceKey.toString('hex'));

// Generate Bob's keys...
const bob = createECDH('secp521r1');
const bobKey = bob.generateKeys();

// Exchange and generate the secret...
const aliceSecret = alice.computeSecret(bobKey);
const bobSecret = bob.computeSecret(aliceKey);

// console.log(aliceSecret.toString('hex'));
// console.log(bobSecret.toString('hex'));
// assert.strictEqual(aliceSecret.toString('hex'), bobSecret.toString('hex'));