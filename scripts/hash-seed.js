const XXHash = require('xxhash');
const crypto = require('crypto');

const version = Buffer.from([0x00]);
const zeroBuffer = Buffer.from(Array(20).fill(0x00));
const fingerprint = zeroBuffer;

let checksum = 0;
for (let i = 0; true; i = crypto.randomBytes(4).readUIntBE(0, 4)) {
  checksum = XXHash.hash(fingerprint, i, 'buffer').slice(-4);

  if (checksum.equals(Buffer.from([0xde, 0xad, 0xde, 0xad]))) {
    console.log('deaddead', i.toString(16));
    break;
  }

  if (checksum.equals(Buffer.from([0x44, 0x44, 0xde, 0xad]))) {
    console.log('4444dead', i.toString(16));
    // break;
  }

  if (checksum.equals(Buffer.from([0xdd, 0xee, 0xaa, 0xdd]))) {
    console.log('ddeeaadd', i.toString(16));
    // break;
  }
}

// console.log(Buffer.concat([version, fingerprint, checksum].toString('hex')));
