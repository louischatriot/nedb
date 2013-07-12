/**
 * Handle every persistence-related task
 */

var fs = require('fs')
  , path = require('path')
  , model = require('./model')
  , customUtils = require('./customUtils')
  ;


/**
 * Create a new Persistence object for database options.db
 * @param {Datastore} options.db
 */
function Persistence (options) {
  this.db = options.db;
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


// Interface
module.exports = Persistence;
