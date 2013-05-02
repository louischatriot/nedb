var fs = require('fs')
  , crypto = require('crypto')
  ;


/**
 * Check if directory exists and create it on the fly if it is not the case
 * TODO: make recursive
 */
function ensureDirectoryExists (dir, cb) {
  var callback = cb || function () {};

  fs.exists(dir, function (exists) {
    if (exists) {
      return callback();
    } else {
      fs.mkdir(dir, '0777', callback);
    }
  });
}


/**
 * Return a random alphanumerical string of length len
 * There is a very small probability for the length to be less than len
 * (il the base64 conversion yields to many pluses and slashes) but
 * that's not an issue here
 */
function uid (len) {
  return crypto.randomBytes(Math.ceil(len * 5 / 4))
    .toString('base64')
    .replace(/[+\/]/g, '')
    .slice(0, len);
}


/**
 * Deep copy an DB object
 * TODO: Put in serialization/deserialization and tackle all cases
 */
function deepCopy (obj) {
  var res;

  if (typeof obj === 'boolean' || typeof obj === 'number' || typeof obj === 'string') {
    return obj;
  }

  if (typeof obj === 'object') {
    res = {};
    Object.keys(obj).forEach(function (k) {
      res[k] = deepCopy(obj[k]);
    });
    return res;
  }

  return undefined;   // For now everything else is undefined. We should probably throw an error instead
}


/**
 * Return an array with the numbers from 0 to n-1, in a random order
 * Used in the benchmarks
 */
function getRandomArray (n) {
  var res, next;

  if (n === 0) { return []; }
  if (n === 1) { return [0]; }

  res = getRandomArray(n - 1);
  next = Math.floor(Math.random() * n);
  res.splice(next, 0, n - 1);   // Add n-1 at a random position in the array

  return res;
}



module.exports.ensureDirectoryExists = ensureDirectoryExists;
module.exports.uid = uid;
module.exports.deepCopy = deepCopy;
module.exports.getRandomArray = getRandomArray;
