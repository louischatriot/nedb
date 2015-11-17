/**
 * Way data is stored for this database
 * For a Node.js/Node Webkit database it's the file system
 * For a browser-side database it's localforage which chooses the best option depending on user browser (IndexedDB then WebSQL then localStorage)
 *
 * This version is the Node.js/Node Webkit version
 * It's essentially fs, mkdirp and crash safe write and read functions
 */

var fs = require('fs')
  , mkdirp = require('mkdirp')
  , async = require('async')
  , storage = {}
  ;

storage.exists = fs.exists;
storage.rename = fs.rename;
storage.writeFile = fs.writeFile;
storage.unlink = fs.unlink;
storage.appendFile = fs.appendFile;
storage.readFile = fs.readFile;
storage.mkdirp = mkdirp;


/**
 * Explicit name ...
 */
storage.ensureFileDoesntExist = function (file, callback) {
  storage.exists(file, function (exists) {
    if (!exists) { return callback(null); }

    storage.unlink(file, function (err) { return callback(err); });
  });
};


/**
 * Fully write or rewrite the datafile, immune to crashes during the write operation (data will not be lost)
 * @param {String} filename
 * @param {String} data
 * @param {Function} cb Optional callback, signature: err
 */
storage.crashSafeWriteFile = function (filename, data, cb) {
  var callback = cb || function () {}
    , tempFilename = filename + '~'
    , oldFilename = filename + '~~'
    ;

  async.waterfall([
    async.apply(storage.ensureFileDoesntExist, tempFilename)
  , async.apply(storage.ensureFileDoesntExist, oldFilename)
  , function (cb) {
      storage.exists(filename, function (exists) {
        if (exists) {
          storage.rename(filename, oldFilename, function (err) { return cb(err); });
        } else {
          return cb();
        }
      });
  }
  , function (cb) {
      storage.writeFile(tempFilename, data, function (err) { return cb(err); });
    }
  , function (cb) {
      storage.rename(tempFilename, filename, function (err) { return cb(err); });
    }
  , async.apply(storage.ensureFileDoesntExist, oldFilename)
  ], function (err) { if (err) { return callback(err); } else { return callback(null); } })
};


/**
 * Ensure the datafile contains all the data, even if there was a crash during a full file write
 * @param {String} filename
 * @param {Function} callback signature: err
 */
storage.ensureDatafileIntegrity = function (filename, callback) {
  var tempFilename = filename + '~'
    , oldFilename = filename + '~~'
    ;

  storage.exists(filename, function (filenameExists) {
    // Write was successful
    if (filenameExists) { return callback(null); }

    storage.exists(oldFilename, function (oldFilenameExists) {
      // New database
      if (!oldFilenameExists) {
        return storage.writeFile(filename, '', 'utf8', function (err) { callback(err); });
      }

      // Write failed, use old version
      storage.rename(oldFilename, filename, function (err) { return callback(err); });
    });
  });
};



// Interface
module.exports = storage;
