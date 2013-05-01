var fs = require('fs')
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


module.exports.ensureDirectoryExists = ensureDirectoryExists;
