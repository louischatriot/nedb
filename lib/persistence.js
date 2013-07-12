/**
 * Handle every persistence-related task
 */

var fs = require('fs')
  , path = require('path')
  , model = require('./model')
  , customUtils = require('./customUtils')
  , async = require('async')
  , mkdirp = require('mkdirp')
  ;


/**
 * Create a new Persistence object for database options.db
 * @param {Datastore} options.db
 */
function Persistence (options) {
  this.db = options.db;
}


/**
 * Check if a directory exists and create it on the fly if it is not the case
 * cb is optional, signature: err
 */
Persistence.ensureDirectoryExists = function (dir, cb) {
  var callback = cb || function () {}
    ;

  mkdirp(dir, function (err) { return callback(err); });
}


/**
 * Persist cached database
 * This serves as a compaction function since the cache always contains only the number of documents in the collection
 * while the data file is append-only so it may grow larger
 * @param {Function} cb Optional callback, signature: err
 */
Persistence.prototype.persistCachedDatabase = function (cb) {
  var callback = cb || function () {}
    , toPersist = ''
    ;

  this.db.getAllData().forEach(function (doc) {
    toPersist += model.serialize(doc) + '\n';
  });

  if (toPersist.length === 0) { return callback(null); }

  fs.writeFile(this.db.filename, toPersist, function (err) { return callback(err); });
};


/**
 * Persist new state for the given newDocs (can be insertion, update or removal)
 * Use an append-only format
 * @param {Array} newDocs Can be empty if no doc was updated/removed
 * @param {Function} cb Optional, signature: err
 */
Persistence.prototype.persistNewState = function (newDocs, cb) {
  var self = this
    , toPersist = ''
    , callback = cb || function () {}
    ;

  // In-memory only datastore
  if (self.db.inMemoryOnly) { return callback(null); }

  self.db.datafileSize += newDocs.length;

  newDocs.forEach(function (doc) {
    toPersist += model.serialize(doc) + '\n';
  });

  if (toPersist.length === 0) { return callback(null); }

  fs.appendFile(self.db.filename, toPersist, 'utf8', function (err) {
    return callback(err);
  });
};


/**
 * From a database's raw data, return the corresponding
 * machine understandable collection
 */
Persistence.treatRawData = function (rawData) {
  var data = rawData.split('\n')
    , dataById = {}
    , res = []
    , i;

  for (i = 0; i < data.length; i += 1) {
    var doc;

    try {
      doc = model.deserialize(data[i]);
      if (doc._id) {
        if (doc.$$deleted === true) {
          delete dataById[doc._id];
        } else {
          dataById[doc._id] = doc;
        }
      }
    } catch (e) {
    }
  }

  Object.keys(dataById).forEach(function (k) {
    res.push(dataById[k]);
  });

  return res;
};


/**
 * Load the database
 * This means pulling data out of the data file or creating it if it doesn't exist
 * Also, all data is persisted right away, which has the effect of compacting the database file
 * This operation is very quick at startup for a big collection (60ms for ~10k docs)
 * @param {Function} cb Optional callback, signature: err
 *
 * @api private Use loadDatabase
 */
Persistence.prototype._loadDatabase = function (cb) {
  var callback = cb || function () {}
    , self = this
    ;

  self.db.resetIndexes();
  self.db.datafileSize = 0;

  // In-memory only datastore
  if (self.db.inMemoryOnly) { return callback(null); }

  async.waterfall([
    function (cb) {
      Persistence.ensureDirectoryExists(path.dirname(self.db.filename), function (err) {
        fs.exists(self.db.filename, function (exists) {
          if (!exists) { return fs.writeFile(self.db.filename, '', 'utf8', function (err) { cb(err); }); }

          fs.readFile(self.db.filename, 'utf8', function (err, rawData) {
            if (err) { return cb(err); }
            var treatedData = Persistence.treatRawData(rawData);

            try {
              self.db.resetIndexes(treatedData);
            } catch (e) {
              self.db.resetIndexes();   // Rollback any index which didn't fail
              self.db.datafileSize = 0;
              return cb(e);
            }

            self.db.datafileSize = treatedData.length;
            self.db.persistence.persistCachedDatabase(cb);
          });
        });
      });
    }
  ], function (err) {
       if (err) { return callback(err); }

       self.db.executor.processBuffer();
       return callback(null);
     });
};


// Interface
module.exports = Persistence;
