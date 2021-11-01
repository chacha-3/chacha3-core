const fs = require('fs');

const dir = './.testdb';
fs.rmSync(dir, { recursive: true });
