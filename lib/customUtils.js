var fs = require('fs')
  , crypto = require('crypto')
  , path = require('path')
  ;


/**
 * Check if a directory exists and create it on the fly if it is not the case
 * Does it recursively
 * cb is optional, signature: err
 */
function ensureDirectoryExists (dir, cb) {
  var callback = cb || function () {}
    , parts, currentPart
    ;

  if (typeof dir === 'string') { return ensureDirectoryExists({ toTreat: dir, treated: '' }, callback); }
  if (dir.toTreat.length === 0) { return callback(); }

  parts = dir.toTreat.split(path.sep);
  currentPart = path.join(dir.treated, parts[0]);

  parts = parts.slice(1).join(path.sep);

  fs.exists(currentPart, function (exists) {
    if (exists) {
      return ensureDirectoryExists({ toTreat: parts, treated: currentPart }, callback);
    } else {
      return fs.mkdir(currentPart, '0777', function (err) {
        if (err) { return callback(err); }
        return ensureDirectoryExists({ toTreat: parts, treated: currentPart }, callback);
      });
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



module.exports.ensureDirectoryExists = ensureDirectoryExists;
module.exports.uid = uid;
