const fs = require('fs');

const dir = './.testdb';

try {
  fs.rmSync(dir, { recursive: true });
} catch (e) {

}
