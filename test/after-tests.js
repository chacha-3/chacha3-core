const fs = require('fs');

const dir = './.testdb';
fs.rmdirSync(dir, { recursive: true });
