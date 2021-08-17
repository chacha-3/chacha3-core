function median(numbers) {
  const sorted = numbers.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomNumberBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// function randomNumberUpTo(max) {
//   return Math.floor(Math.random() * max + 1);
// }

module.exports = {
  median,
  clamp,
  randomNumberBetween,
};
