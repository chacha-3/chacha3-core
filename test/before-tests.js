const fs = require('fs');

const dir = './.localdata';

try {
  fs.rmSync(dir, { recursive: true });
} catch (e) {

}
