const { argon2d } = require('argon2-ffi');
const crypto = require('crypto');
const util = require('util');
const os = require('os');

const getRandomBytes = util.promisify(crypto.randomBytes);

const password = Buffer.from('password1');


const options = {
  timeCost: 8,
  memoryCost: 16384,
  parallelism: 16,
  hashLength: 32,
};

async function main(i) {
  // console.log('run');
  
  
  // const salt = await getRandomBytes(32);
  const hashedPassword = await argon2d.hash(password, Buffer.from([]), options);
  // for (let i = 0; i < hashedPassword.length; i += 1) {
  //   console.log(hashedPassword[i]);
  // }
  // console.log(hashedPassword);
}

async function run() {
  while (true) {
    // await sleep(1);
    if (os.freemem() > 1961050624) {
      main();
    }
  }
}

async function test() {
  const salt = Buffer.from(new Array(32).fill(0x01));
  const hashPassword = await argon2d.hash(password, salt, options);
  const rawPassword = await argon2d.hashRaw(password, salt, options);
  console.log(hashPassword);
  console.log(rawPassword.toString('base64'));
  console.log(salt.toString('base64'));
}

// run();

test();

// console.log(os.cpus());
// console.log(os.totalmem());
// console.log(os.freemem());

console.log('done');
