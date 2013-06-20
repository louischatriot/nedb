var fs = require('fs')
  , crypto = require('crypto')
  , path = require('path')
  , mkdirp = require('mkdirp')
  ;


/**
 * Check if a directory exists and create it on the fly if it is not the case
 * cb is optional, signature: err
 */
function ensureDirectoryExists (dir, cb) {
  var callback = cb || function () {}
    ;

  mkdirp(dir, function (err) { return callback(err); });
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


/**
 * Return the path the datafile if the given filename is relative to the directory where Node Webkit stores
 * data for this application. Probably the best place to store data
 */
function getNWAppFilename (appName, relativeFilename) {
  var home;

  switch (process.platform) {
    case 'win32':
    case 'win64':
      home = process.env.LOCALAPPDATA || process.env.APPDATA;
      if (!home) { throw "Couldn't find the base application data folder"; }
      home = path.join(home, appName);
      break;
    case 'darwin':
      home = process.env.HOME;
      if (!home) { throw "Couldn't find the base application data directory"; }
      home = path.join(home, 'Library', 'Application Support', appName);
      break;
    case 'linux':
      home = process.env.HOME;
      if (!home) { throw "Couldn't find the base application data directory"; }
      home = path.join(home, '.config', appName);
      break;
    default:
      throw "Can't use the Node Webkit relative path for platform " + process.platform;
      break;
  }

  return path.join(home, 'nedb-data', relativeFilename);
}


module.exports.ensureDirectoryExists = ensureDirectoryExists;
module.exports.uid = uid;
module.exports.getNWAppFilename = getNWAppFilename;
