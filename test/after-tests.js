const fs = require('fs');

const dir = './.localdata';
fs.rmSync(dir, { recursive: true });
