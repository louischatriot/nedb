/**
 * The datastore itself
 * TODO
 * Update and removes should only modify the corresponding part of the database (or use much faster append-only format)
 */

var fs = require('fs')
  , path = require('path')
  , customUtils = require('./customUtils')
  , model = require('./model')
  , async = require('async')
  , executor = require('./executor')
  ;


/**
 * Create a new collection
 */
function Datastore (filename) {
  this.filename = filename;
  this.data = [];
}


/**
 * Load the database
 * For now this means pulling data out of the data file or creating it
 * if it doesn't exist
 * @param {Function} cb Optional callback, signature: err
 */
Datastore.prototype.loadDatabase = function (cb) {
  var callback = cb || function () {}
    , self = this
    ;

  customUtils.ensureDirectoryExists(path.dirname(self.filename), function (err) {
    fs.exists(self.filename, function (exists) {
      if (!exists) {
        self.data = [];
        fs.writeFile(self.filename, '', 'utf8', function (err) { return callback(err); });
      } else {
        fs.readFile(self.filename, 'utf8', function (err, rawData) {
          if (err) { return callback(err); }
          self.data = Datastore.treatRawData(rawData);
          return callback();
        });
      }
    });
  });
};


/**
 * From a database's raw data, return the corresponding
 * machine understandable collection
 */
Datastore.treatRawData = function (rawData) {
  var data = rawData.split('\n')
    , res = [];

  data.forEach(function (d) {
    var doc;

    try {
      doc = model.deserialize(d);
      res.push(doc);
    } catch (e) {
    }
  });

  return res;
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
    ;

  try {
    newDoc._id = newDoc._id || customUtils.uid(16);
    persistableNewDoc = model.serialize(newDoc);
  } catch (e) {
    return callback(e);
  }

  fs.appendFile(self.filename, persistableNewDoc + '\n', 'utf8', function (err) {
    if (err) { return callback(err); }

    var insertedDoc = model.deserialize(persistableNewDoc);
    self.data.push(insertedDoc);   // Make sure the doc is the same on the disk and in memory
                                                     // Some docs can't be stringified correctly
    return callback(null, insertedDoc);
  });
};

Datastore.prototype.insert = function () {
  executor.push({ this: this, fn: this._insert, arguments: arguments });
};


/**
 * Find all documents matching the query
 * @param {Object} query MongoDB-style query
 */
Datastore.prototype.find = function (query, callback) {
  var res = []
    , self = this
    , i
    ;

  try {
    for (i = 0; i < self.data.length; i += 1) {
      if (model.match(self.data[i], query)) {
        res.push(model.deepCopy(self.data[i]));
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
    , i
    ;

  try {
    for (i = 0; i < self.data.length; i += 1) {
      if (model.match(self.data[i], query)) {
        return callback(null, model.deepCopy(self.data[i]));
      }
    }
  } catch (err) {
    return callback(err);
  }

  return callback(null, null);
};


/**
 * Persist the whole database
 * @param {Array} data Optional data to persist. If not set, we use the database data
 * @param {Function} cb Optional callback, signature: err
 */
Datastore.prototype.persistWholeDatabase = function (data, cb) {
  var callback
    , self = this
    , newContents = '';

  if (!data) {
    data = self.data;
  }

  if (typeof data === 'function') {
    cb = data;
    data = self.data;
  }

  callback = cb || function () {};

  data.forEach(function (d) {
    newContents += model.serialize(d) + '\n';
  });

  fs.writeFile(self.filename, newContents, 'utf8', callback);
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
    , newData = [];

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
    try {
      self.data.forEach(function (d) {
        if (model.match(d, query) && (multi || numReplaced === 0)) {
          numReplaced += 1;
          newData.push(model.modify(d, updateQuery));
        } else {
          newData.push(d);
        }
      });
    } catch (err) {
      return callback(err);
    }

    self.persistWholeDatabase(newData, function (err) {
      if (err) { return callback(err); }
      self.data = newData;
      return callback(null, numReplaced);
    });
  }
  ]);
};
Datastore.prototype.update = function () {
  executor.push({ this: this, fn: this._update, arguments: arguments });
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
    , newData = [];

  if (typeof options === 'function') { cb = options; options = {}; }
  callback = cb || function () {};
  multi = options.multi !== undefined ? options.multi : false;

  try {
    self.data.forEach(function (d) {
      if (model.match(d, query) && (multi || numRemoved === 0)) {
        numRemoved += 1;
      } else {
        newData.push(d);
      }
    });
  } catch (err) {
    return callback(err);
  }

  self.persistWholeDatabase(newData, function (err) {
    if (err) { return callback(err); }
    self.data = newData;
    return callback(null, numRemoved);
  });
};
Datastore.prototype.remove = function () {
  executor.push({ this: this, fn: this._remove, arguments: arguments });
};


module.exports = Datastore;
