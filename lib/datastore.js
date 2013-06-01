var fs = require('fs')
  , path = require('path')
  , customUtils = require('./customUtils')
  , model = require('./model')
  , async = require('async')
  , Executor = require('./executor')
  , Index = require('./indexes')
  , util = require('util')
  , _ = require('underscore')
  ;


/**
 * Create a new collection
 * If a filename is provided, persist it to disk
 * Otherwise keep it in memory (data will be lost when the application stops)
 */
function Datastore (filename) {
  if (!filename || typeof filename !== 'string' || filename.length === 0) {
    this.filename = null;
  } else {
    this.filename = filename;
  }

  this.executor = new Executor();

  // We keep internally the number of lines in the datafile
  // This will be used when/if I implement autocompacting when the datafile grows too big
  this.datafileSize = 0;

  // Indexed by field name, dot notation can be used
  // _id is always indexed and since _ids are generated randomly the underlying
  // binary is always well-balanced
  this.indexes = {};
  this.indexes._id = new Index({ fieldName: '_id', unique: true });
}


/**
 * Get an array of all the data in the database
 */
Datastore.prototype.getAllData = function () {
  return this.indexes._id.getAll();
};


/**
 * Reset all currently defined indexes
 */
Datastore.prototype.resetIndexes = function (newData) {
  var self = this;

  Object.keys(this.indexes).forEach(function (i) {
    self.indexes[i].reset(newData);
  });
};


/**
 * Ensure an index is kept for this field. Same parameters as lib/indexes
 * For now this function is synchronous, we need to test how much time it takes
 * We use an async API for consistency with the rest of the code
 * @param {String} options.fieldName
 * @param {Boolean} options.unique
 * @param {Boolean} options.sparse
 * @param {Function} cb Optional callback, signature: err
 */
Datastore.prototype.ensureIndex = function (options, cb) {
  var callback = cb || function () {};

  options = options || {};

  if (!options.fieldName) { return callback({ missingFieldName: true }); }
  if (this.indexes[options.fieldName]) { return callback(); }

  options.datastore = this;
  this.indexes[options.fieldName] = new Index(options);

  try {
    this.indexes[options.fieldName].insert(this.getAllData());
  } catch (e) {
    delete this.indexes[options.fieldName];
    return callback(e);
  }

  return callback();
};


/**
 * Add one or several document(s) to all indexes
 */
Datastore.prototype.addToIndexes = function (doc) {
  var i, failingIndex, error
    , keys = Object.keys(this.indexes)
    ;

  for (i = 0; i < keys.length; i += 1) {
    try {
      this.indexes[keys[i]].insert(doc);
    } catch (e) {
      failingIndex = i;
      error = e;
      break;
    }
  }

  // If an error happened, we need to rollback the insert on all other indexes
  if (error) {
    for (i = 0; i < failingIndex; i += 1) {
      this.indexes[keys[i]].remove(doc);
    }

    throw error;
  }
};


/**
 * Remove one or several document(s) from all indexes
 */
Datastore.prototype.removeFromIndexes = function (doc) {
  var self = this;

  Object.keys(this.indexes).forEach(function (i) {
    self.indexes[i].remove(doc);
  });
};


/**
 * Update one or several documents in all indexes
 * If one update violates a constraint, all changes are rolled back
 */
Datastore.prototype.updateIndexes = function (oldDoc, newDoc) {
  var i, failingIndex, error
    , keys = Object.keys(this.indexes)
    ;

  for (i = 0; i < keys.length; i += 1) {
    try {
      this.indexes[keys[i]].update(oldDoc, newDoc);
    } catch (e) {
      failingIndex = i;
      error = e;
      break;
    }
  }

  // If an error happened, we need to rollback the insert on all other indexes
  if (error) {
    for (i = 0; i < failingIndex; i += 1) {
      this.indexes[keys[i]].revertUpdate(oldDoc, newDoc);
    }

    throw error;
  }
};


/**
 * Return the list of candidates for a given query
 * Very crude implementation for now, we return the candidates given by the first usable index if any
 * Also indexes can only be used for direct matches (no $lt, $gt or array yet)
 * This still gives a huge performance boost to finds (800x on a collection with 10k documents)
 */
Datastore.prototype.getCandidates = function (query) {
  var indexNames = Object.keys(this.indexes)
    , usableQueryKeys;

  if (indexNames.length <= 1) { return this.getAllData(); }   // No index defined (except _id), no specific candidate

  // Usable query keys are the ones corresponding to a basic query (no use of $operators or arrays)
  usableQueryKeys = [];
  Object.keys(query).forEach(function (k) {
    if (typeof query[k] === 'string' || typeof query[k] === 'number' || typeof query[k] === 'boolean' || util.isDate(query[k]) || query[k] === null) {
      usableQueryKeys.push(k);
    }
  });

  usableQueryKeys = _.intersection(usableQueryKeys, indexNames);

  if (usableQueryKeys.length > 0) {
    return this.indexes[usableQueryKeys[0]].getMatching(query[usableQueryKeys[0]]);
  } else {
    return this.getAllData();
  }
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
Datastore.prototype._loadDatabase = function (cb) {
  var callback = cb || function () {}
    , self = this
    ;

  // In-memory only datastore
  if (!self.filename) { return callback(); }

  customUtils.ensureDirectoryExists(path.dirname(self.filename), function (err) {
    fs.exists(self.filename, function (exists) {
      if (!exists) {
        self.resetIndexes();
        self.datafileSize = 0;
        fs.writeFile(self.filename, '', 'utf8', function (err) { return callback(err); });
        return;
      }

      fs.readFile(self.filename, 'utf8', function (err, rawData) {
        if (err) { return callback(err); }
        var treatedData = Datastore.treatRawData(rawData);

        try {
          self.resetIndexes(treatedData);
        } catch (e) {
          self.resetIndexes();   // Rollback any index which didn't fail
          self.datafileSize = 0;
          return callback(e);
        }

        self.datafileSize = treatedData.length;
        self.persistCachedDatabase(callback);
      });
    });
  });
};

Datastore.prototype.loadDatabase = function () {
  this.executor.push({ this: this, fn: this._loadDatabase, arguments: arguments });
};


/**
 * From a database's raw data, return the corresponding
 * machine understandable collection
 */
Datastore.treatRawData = function (rawData) {
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
 * Persist cached database
 * This serves as a compaction function since the cache always contains only the number of documents in the collection
 * while the data file is append-only so it may grow larger
 * @param {Function} cb Optional callback, signature: err
 */
Datastore.prototype.persistCachedDatabase = function (cb) {
  var callback = cb || function () {}
    , toPersist = ''
    ;

  this.getAllData().forEach(function (doc) {
    toPersist += model.serialize(doc) + '\n';
  });

  if (toPersist.length === 0) { return callback(); }

  fs.writeFile(this.filename, toPersist, function (err) { return callback(err); });
};


/**
 * Persist new state for the given newDocs (can be insertion, update or removal)
 * Use an append-only format
 * @param {Array} newDocs Can be empty if no doc was updated/removed
 * @param {Function} cb Optional, signature: err
 */
Datastore.prototype.persistNewState = function (newDocs, cb) {
  var self = this
    , toPersist = ''
    , callback = cb || function () {}
    ;

  // In-memory only datastore
  if (!self.filename) { return callback(); }

  self.datafileSize += newDocs.length;

  newDocs.forEach(function (doc) {
    toPersist += model.serialize(doc) + '\n';
  });

  if (toPersist.length === 0) { return callback(); }

  fs.appendFile(self.filename, toPersist, 'utf8', function (err) {
    return callback(err);
  });
};


/**
 * Insert a new document
 * @param {Function} cb Optional callback, signature: err, insertedDoc
 *
 * @api private Use Datastore.insert which has the same signature
 */
Datastore.prototype._insert = function (newDoc, cb) {
  var callback = cb || function () {}
    , self = this
    , insertedDoc
    ;

  // Ensure the document has the right format
  try {
    newDoc._id = customUtils.uid(16);
    model.checkObject(newDoc);
    insertedDoc = model.deepCopy(newDoc);
  } catch (e) {
    return callback(e);
  }

  // Insert in all indexes (also serves to ensure uniqueness)
  try { self.addToIndexes(insertedDoc); } catch (e) { return callback(e); }

  this.persistNewState([newDoc], function (err) {
    if (err) { return callback(err); }
    return callback(null, newDoc);
  });
};

Datastore.prototype.insert = function () {
  this.executor.push({ this: this, fn: this._insert, arguments: arguments });
};


/**
 * Find all documents matching the query
 * @param {Object} query MongoDB-style query
 */
Datastore.prototype.find = function (query, callback) {
  var res = []
    , self = this
    , candidates = this.getCandidates(query)
    , i
    ;

  try {
    for (i = 0; i < candidates.length; i += 1) {
      if (model.match(candidates[i], query)) {
        res.push(model.deepCopy(candidates[i]));
      }
    }
  } catch (err) {
    return callback(err);
  }

  return callback(null, res);
};


/**
 * Find one document matching the query
 * @param {Object} query MongoDB-style query
 */
Datastore.prototype.findOne = function (query, callback) {
  var self = this
    , candidates = this.getCandidates(query)
    , i
    ;

  try {
    for (i = 0; i < candidates.length; i += 1) {
      if (model.match(candidates[i], query)) {
        return callback(null, model.deepCopy(candidates[i]));
      }
    }
  } catch (err) {
    return callback(err);
  }

  return callback(null, null);
};


/**
 * Update all docs matching query
 * For now, very naive implementation (recalculating the whole database)
 * @param {Object} query
 * @param {Object} updateQuery
 * @param {Object} options Optional options
 *                 options.multi If true, can update multiple documents (defaults to false)
 *                 options.upsert If true, document is inserted if the query doesn't match anything
 * @param {Function} cb Optional callback, signature: err, numReplaced, upsert (set to true if the update was in fact an upsert)
 *
 * @api private Use Datastore.update which has the same signature
 */
Datastore.prototype._update = function (query, updateQuery, options, cb) {
  var callback
    , self = this
    , numReplaced = 0
    , multi, upsert
    , updatedDocs = []
    , candidates
    , i
    ;

  if (typeof options === 'function') { cb = options; options = {}; }
  callback = cb || function () {};
  multi = options.multi !== undefined ? options.multi : false;
  upsert = options.upsert !== undefined ? options.upsert : false;

  async.waterfall([
  function (cb) {   // If upsert option is set, check whether we need to insert the doc
    if (!upsert) { return cb(); }

    self.findOne(query, function (err, doc) {
      if (err) { return callback(err); }
      if (doc) {
        return cb();
      } else {
        // The upserted document is the query (since for now queries have the same structure as
        // documents), modified by the updateQuery
        return self._insert(model.modify(query, updateQuery), function (err) {
          if (err) { return callback(err); }
          return callback(null, 1, true);
        });
      }
    });
  }
  , function () {   // Perform the update
    var modifiedDoc;

    candidates = self.getCandidates(query);

    try {
      for (i = 0; i < candidates.length; i += 1) {
        if (model.match(candidates[i], query) && (multi || numReplaced === 0)) {
          numReplaced += 1;
          modifiedDoc = model.modify(candidates[i], updateQuery);
          self.updateIndexes(candidates[i], modifiedDoc);
          updatedDocs.push(modifiedDoc);
        }
      }
    } catch (err) {
      return callback(err);
    }

    self.persistNewState(updatedDocs, function (err) {
      if (err) { return callback(err); }
      return callback(null, numReplaced);
    });
  }
  ]);
};
Datastore.prototype.update = function () {
  this.executor.push({ this: this, fn: this._update, arguments: arguments });
};


/**
 * Remove all docs matching the query
 * For now very naive implementation (similar to update)
 * @param {Object} query
 * @param {Object} options Optional options
 *                 options.multi If true, can update multiple documents (defaults to false)
 * @param {Function} cb Optional callback, signature: err, numRemoved
 *
 * @api private Use Datastore.remove which has the same signature
 */
Datastore.prototype._remove = function (query, options, cb) {
  var callback
    , self = this
    , numRemoved = 0
    , multi
    , removedDocs = []
    , candidates = this.getCandidates(query)
    ;

  if (typeof options === 'function') { cb = options; options = {}; }
  callback = cb || function () {};
  multi = options.multi !== undefined ? options.multi : false;

  try {
    candidates.forEach(function (d) {
      if (model.match(d, query) && (multi || numRemoved === 0)) {
        numRemoved += 1;
        removedDocs.push({ $$deleted: true, _id: d._id });
        self.removeFromIndexes(d);
      }
    });
  } catch (err) { return callback(err); }

  self.persistNewState(removedDocs, function (err) {
    if (err) { return callback(err); }
    return callback(null, numRemoved);
  });
};
Datastore.prototype.remove = function () {
  this.executor.push({ this: this, fn: this._remove, arguments: arguments });
};



module.exports = Datastore;
