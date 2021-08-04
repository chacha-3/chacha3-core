const { argon2d } = require('argon2-ffi');
const crypto = require('crypto');
const util = require('util');
const os = require('os');

// const getRandomBytes = util.promisify(crypto.randomBytes);

const password = Buffer.from('password1');

const options = {
  timeCost: 1,
  memoryCost: 1024,
  parallelism: 2,
  hashLength: 32,
};

const num = 2000;

const { performance } = require('perf_hooks');
const start = performance.now();

function main(i) {
  const salt = crypto.randomBytes(32);
  const hashedPassword = argon2d.hashRaw(password, salt, options).then((result, reject) => {
    // console.log(i);
    if (result[0] == 0x00) {
      console.log(i, result.toString('hex'));
    }

    if (i === num - 1) {
      const end = performance.now();
      console.log(`Done: ${end - start}`);
    }
  });

  // console.log(hashedPassword);
  // for (let i = 0; i < hashedPassword.length; i += 1) {
  //   console.log(hashedPassword[i]);
  // }
  // console.log(hashedPassword);
}

function run() {
  // let i = 0;

  for (let i = 0; i < num; i += 1) {
  // while (true) {
    // await sleep(1);
    if (os.freemem() > 1961050624) {
      // eslint-disable-next-line no-await-in-loop
      main(i);
    }
    // i += 1;
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


run();

// test();

// console.log(os.cpus());
// console.log(os.totalmem());
// console.log(os.freemem());

// console.log('done');
