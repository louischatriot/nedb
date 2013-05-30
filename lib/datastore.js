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
 */
function Datastore (filename) {
  this.filename = filename;
  this.data = [];
  this.executor = new Executor();

  // We keep internally the number of lines in the datafile
  // This will be used when/if I implement autocompacting when the datafile grows too big
  this.datafileSize = 0;

  // Indexed by field name, dot notation can be used
  this.indexes = {};
}


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
 * @param {String} options.fieldName
 * @param {Boolean} options.unique
 * @param {Boolean} options.sparse
 * @return {Boolean} true if index was created or already exists, false otherwise
 */
Datastore.prototype.ensureIndex = function (options) {
  options = options || {};

  if (!options.fieldName) { return false; }
  if (this.indexes[options.fieldName]) { return true; }

  options.datastore = this;
  this.indexes[options.fieldName] = new Index(options);
  this.indexes[options.fieldName].insert(this.data);

  return true;
};


/**
 * Add one or several document(s) to all indexes
 */
Datastore.prototype.addToIndexes = function (doc) {
  var self = this
    , i, failingIndex, error
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
 * Update a document in all indexes
 */
Datastore.prototype.removeFromIndexes = function (doc, newDoc) {
  var self = this;

  Object.keys(this.indexes).forEach(function (i) {
    self.indexes[i].update(doc, newDoc);
  });
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

  if (indexNames.length === 0) { return this.data; }   // No index defined, no specific candidate

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
    return this.data;
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

  customUtils.ensureDirectoryExists(path.dirname(self.filename), function (err) {
    fs.exists(self.filename, function (exists) {
      if (!exists) {
        self.data = [];
        self.datafileSize = 0;
        fs.writeFile(self.filename, '', 'utf8', function (err) { return callback(err); });
      } else {
        fs.readFile(self.filename, 'utf8', function (err, rawData) {
          if (err) { return callback(err); }
          self.data = Datastore.treatRawData(rawData);
          self.datafileSize = self.data.length;
          self.resetIndexes(self.data);
          self.persistCachedDatabase(callback);
        });
      }
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

  this.data.forEach(function (doc) {
    toPersist += model.serialize(doc) + '\n';
  });

  if (toPersist.length === 0) { return callback(); }

  fs.writeFile(this.filename, toPersist, function (err) { return callback(err); });

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
    , persistableNewDoc
    , insertedDoc
    ;

  // Ensure the document has the right format
  try {
    newDoc._id = customUtils.uid(16);
    persistableNewDoc = model.serialize(newDoc);
  } catch (e) {
    return callback(e);
  }

  insertedDoc = model.deserialize(persistableNewDoc);

  // Insert in all indexes (also serves to ensure uniqueness)
  try { self.addToIndexes(insertedDoc); } catch (e) { return callback(e); }

  fs.appendFile(self.filename, persistableNewDoc + '\n', 'utf8', function (err) {
    if (err) { return callback(err); }

    self.data.push(insertedDoc);
    self.datafileSize += 1;
    return callback(null, model.deepCopy(insertedDoc));
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
 * Persist new state for the given newDocs (can be update or removal)
 * Use an append-only format
 * @param {Array} newDocs Can be empty if no doc was updated/removed
 * @param {Function} cb Optional, signature: err
 */
Datastore.prototype.persistNewState = function (newDocs, cb) {
  var self = this
    , toPersist = ''
    , callback = cb || function () {}
    ;

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
    candidates = self.getCandidates(query)

    try {
      for (i = 0; i < candidates.length; i += 1) {
        if (model.match(candidates[i], query) && (multi || numReplaced === 0)) {
          numReplaced += 1;
          candidates[i] = model.modify(candidates[i], updateQuery);
          updatedDocs.push(candidates[i]);
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
    //, candidates = this.getCandidates(query)
    , numRemoved = 0
    , multi
    , newData = []
    , removedDocs = []
    ;

  if (typeof options === 'function') { cb = options; options = {}; }
  callback = cb || function () {};
  multi = options.multi !== undefined ? options.multi : false;

  try {
    self.data.forEach(function (d) {
      if (model.match(d, query) && (multi || numRemoved === 0)) {
        numRemoved += 1;
        removedDocs.push({ $$deleted: true, _id: d._id });
        self.removeFromIndexes(d);
      } else {
        newData.push(d);
      }
    });
  } catch (err) {
    return callback(err);
  }

  self.persistNewState(removedDocs, function (err) {
    if (err) { return callback(err); }
    self.data = newData;
    return callback(null, numRemoved);
  });
};
Datastore.prototype.remove = function () {
  this.executor.push({ this: this, fn: this._remove, arguments: arguments });
};




module.exports = Datastore;
