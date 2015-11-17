/**
 * Manage access to data, be it to find, update or remove it
 */
var model = require('./model')
  , _ = require('underscore')
  ;



/**
 * Create a new cursor for this collection
 * @param {Datastore} db - The datastore this cursor is bound to
 * @param {Query} query - The query this cursor will operate on
 * @param {Function} execDn - Handler to be executed after cursor has found the results and before the callback passed to find/findOne/update/remove
 */
function Cursor (db, query, execFn) {
  this.db = db;
  this.query = query || {};
  if (execFn) { this.execFn = execFn; }
}


/**
 * Set a limit to the number of results
 */
Cursor.prototype.limit = function(limit) {
  this._limit = limit;
  return this;
};


/**
 * Skip a the number of results
 */
Cursor.prototype.skip = function(skip) {
  this._skip = skip;
  return this;
};


/**
 * Sort results of the query
 * @param {SortQuery} sortQuery - SortQuery is { field: order }, field can use the dot-notation, order is 1 for ascending and -1 for descending
 */
Cursor.prototype.sort = function(sortQuery) {
  this._sort = sortQuery;
  return this;
};


/**
 * Add the use of a projection
 * @param {Object} projection - MongoDB-style projection. {} means take all fields. Then it's { key1: 1, key2: 1 } to take only key1 and key2
 *                              { key1: 0, key2: 0 } to omit only key1 and key2. Except _id, you can't mix takes and omits
 */
Cursor.prototype.projection = function(projection) {
  this._projection = projection;
  return this;
};


/**
 * Apply the projection
 */
Cursor.prototype.project = function (candidates) {
  var res = [], self = this
    , keepId, action, keys
    ;

  if (this._projection === undefined || Object.keys(this._projection).length === 0) {
    return candidates;
  }

  keepId = this._projection._id === 0 ? false : true;
  this._projection = _.omit(this._projection, '_id');

  // Check for consistency
  keys = Object.keys(this._projection);
  keys.forEach(function (k) {
    if (action !== undefined && self._projection[k] !== action) { throw "Can't both keep and omit fields except for _id"; }
    action = self._projection[k];
  });

  // Do the actual projection
  candidates.forEach(function (candidate) {
    var toPush = action === 1 ? _.pick(candidate, keys) : _.omit(candidate, keys);
    if (keepId) {
      toPush._id = candidate._id;
    } else {
      delete toPush._id;
    }
    res.push(toPush);
  });

  return res;
};


/**
 * Get all matching elements
 * Will return pointers to matched elements (shallow copies), returning full copies is the role of find or findOne
 * This is an internal function, use exec which uses the executor
 *
 * @param {Function} callback - Signature: err, results
 */
Cursor.prototype._exec = function(callback) {
  var candidates = this.db.getCandidates(this.query)
    , res = [], added = 0, skipped = 0, self = this
    , error = null
    , i, keys, key
    ;

  try {
    for (i = 0; i < candidates.length; i += 1) {
      if (model.match(candidates[i], this.query)) {
        // If a sort is defined, wait for the results to be sorted before applying limit and skip
        if (!this._sort) {
          if (this._skip && this._skip > skipped) {
            skipped += 1;
          } else {
            res.push(candidates[i]);
            added += 1;
            if (this._limit && this._limit <= added) { break; }
          }
        } else {
          res.push(candidates[i]);
        }
      }
    }
  } catch (err) {
    return callback(err);
  }

  // Apply all sorts
  if (this._sort) {
    keys = Object.keys(this._sort);

    // Sorting
    var criteria = [];
    for (i = 0; i < keys.length; i++) {
      key = keys[i];
      criteria.push({ key: key, direction: self._sort[key] });
    }
    res.sort(function(a, b) {
      var criterion, compare, i;
      for (i = 0; i < criteria.length; i++) {
        criterion = criteria[i];
        compare = criterion.direction * model.compareThings(model.getDotValue(a, criterion.key), model.getDotValue(b, criterion.key));
        if (compare !== 0) {
          return compare;
        }
      }
      return 0;
    });

    // Applying limit and skip
    var limit = this._limit || res.length
      , skip = this._skip || 0;

    res = res.slice(skip, skip + limit);
  }

  // Apply projection
  try {
    res = this.project(res);
  } catch (e) {
    error = e;
    res = undefined;
  }

  if (this.execFn) {
    return this.execFn(error, res, callback);
  } else {
    return callback(error, res);
  }
};

Cursor.prototype.exec = function () {
  this.db.executor.push({ this: this, fn: this._exec, arguments: arguments });
};



// Interface
module.exports = Cursor;
