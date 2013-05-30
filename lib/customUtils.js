var fs = require('fs')
  , crypto = require('crypto')
  , path = require('path')
  , childProcess = require('child_process')
  ;


/**
 * Check if a directory exists and create it on the fly if it is not the case
 * cb is optional, signature: err
 */
function ensureDirectoryExists (dir, cb) {
  var callback = cb || function () {}
    ;

  childProcess.exec('mkdir -p ' + dir.replace(/ /g, '\\ '), function (err) { return callback(err); });
}


/**
 * Return a random alphanumerical string of length len
 * There is a very small probability (less than 1/1,000,000) for the length to be less than len
 * (il the base64 conversion yields too many pluses and slashes) but
 * that's not an issue here
 * The probability of a collision is extremely small (need 3*10^12 documents to have one chance in a million of a collision)
 * See http://en.wikipedia.org/wiki/Birthday_problem
 */
function uid (len) {
  return crypto.randomBytes(Math.ceil(Math.max(8, len * 2)))
    .toString('base64')
    .replace(/[+\/]/g, '')
    .slice(0, len);
}



module.exports.ensureDirectoryExists = ensureDirectoryExists;
module.exports.uid = uid;
