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

  childProcess.exec('mkdir -p ' + dir, function (err) { return callback(err); });
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



module.exports.ensureDirectoryExists = ensureDirectoryExists;
module.exports.uid = uid;
