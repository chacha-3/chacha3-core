var parse = require('shell-quote').parse;
var xs = parse('addWallet a:123 b:ccc d:"hello"');
console.dir(xs);