/**
 * Manage access to data, be it to find, update or remove it
 */
var model = require('./model');



/**
 * Create a new cursor for this collection
 * @param {Datastore} db - The datastore this cursor is bound to
 * @param {Query} query - The query this cursor will operate on
 * @param {Function} execFn - Handler to be executed after cursor has found the results and before the callback passed to find/findOne/update/remove
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
  var res = [], self = this, keepId, action, keys, key, i;

  if (this._projection === undefined || Object.keys(this._projection).length === 0) {
    return candidates;
  }

  keepId = self._projection._id !== 0;
  delete this._projection._id;//remove _id property from projection if there

  // Check for consistency
  keys = Object.keys(self._projection);
  i = keys.length;
  while (i--){
    key = keys[i];
    if (action !== undefined && self._projection[key] !== action) { throw new Error("Can't both keep and omit fields except for _id"); }
    action = self._projection[key];
  }
  //construct the projection in object form
  var projection = {};
  i = keys.length;
  var keyParts,keyPart, j, keyPartsLen, root;
  while(i--){
    keyParts = keys[i].split('.');//dot notation shows deeper level for object, so we will traverse that
    keyPartsLen = keyParts.length;
    root = projection;
    j = -1;
    while (++j < keyPartsLen){
      keyPart = keyParts[j];//get current part of
      if (j < (keyPartsLen - 1)){//we will go deeper
        root[keyPart] = root[keyPart] || {};//initialize if not already there
        root = root[keyPart];//move root deeper for reference
      }
    }//end of iteration of keyParts
    root[keyPart] = self._projection[keys[i]];//assign value
  }
  // Do the actual projection
  var candidate, query, toPush;
  i = candidates.length;
  query = self.query;
  while (i--){
    candidate = candidates[i];
    if (action === 1){//inclusion
      toPush = Cursor.pick(candidate,projection,query);
    }
    else{//exclusion
      toPush = Cursor.omit(candidate,projection);
    }
    if (!keepId){
      delete toPush._id;
    }
    else{
      toPush._id = candidate._id;
    }
    res.unshift(toPush);
  }
  return res;
};


/**
 * Get all matching elements
 * Will return pointers to matched elements (shallow copies), returning full copies is the role of find or findOne
 * This is an internal function, use exec which uses the executor
 *
 * @param {Function} callback - Signature: err, results
 */
Cursor.prototype._exec = function(_callback) {
  var res = [], added = 0, skipped = 0, self = this
    , error = null
    , i, keys, key
    ;

  function callback (error, res) {
    if (self.execFn) {
      return self.execFn(error, res, _callback);
    } else {
      return _callback(error, res);
    }
  }

  this.db.getCandidates(this.query, function (err, candidates) {
    if (err) { return callback(err); }

    try {
      for (i = 0; i < candidates.length; i += 1) {
        if (model.match(candidates[i], self.query)) {
          // If a sort is defined, wait for the results to be sorted before applying limit and skip
          if (!self._sort) {
            if (self._skip && self._skip > skipped) {
              skipped += 1;
            } else {
              res.push(candidates[i]);
              added += 1;
              if (self._limit && self._limit <= added) { break; }
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
    if (self._sort) {
      keys = Object.keys(self._sort);

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
          compare = criterion.direction * model.compareThings(model.getDotValue(a, criterion.key), model.getDotValue(b, criterion.key), self.db.compareStrings);
          if (compare !== 0) {
            return compare;
          }
        }
        return 0;
      });

      // Applying limit and skip
      var limit = self._limit || res.length
        , skip = self._skip || 0;

      res = res.slice(skip, skip + limit);
    }

    // Apply projection
    try {
      res = self.project(res);
    } catch (e) {
      error = e;
      res = undefined;
    }

    return callback(error, res);
  });
};

Cursor.prototype.exec = function () {
  this.db.executor.push({ this: this, fn: this._exec, arguments: arguments });
};

//helper functions
/**
 * Return only selected document properties.
 * Will also traverse through projection object with dot notation for embedded documents and arrays
 *
 * @param {Object} doc - The source doc from where data will be retrieved
 * @param {Object} projection - The projection doc based on which selection of properties will take place
 * @param {Object} query - The query that came with the operation, in case positional operator '$' was used in project
 */
Cursor.pick = function(doc,projection,query){
  var copy = {};//object that will be returned to caller;
  var projectKeys = Object.keys(projection);
  var i = projectKeys.length;
  var key, keyValue, docValue, tmpDoc, j;
  while (i--){//browse projection properties...
    key = projectKeys[i];//get hold of current projection key
    //first we need to see if this property exists in source doc. If not, no further processing is needed
    if (!doc[key]) continue;//move on to next property
    //property exists, we should check the property type
    keyValue = projection[key];
    docValue = doc[key];
    if (keyValue === 1 || keyValue === true){//direct inclusion of total source doc property
      copy[key] = docValue;
    }
    //we have deeper level
    else if (!!keyValue.$ && !Array.isArray(docValue)){//positional operator used on a non array element... skip
      continue;
    }
    else if (!!keyValue.$ && Array.isArray(docValue)){//apply positional operator in array
      copy[key] = [];//initialize doc array
      var arrayEl;
      for (var j = 0, jLen = docValue.length;j<jLen;j++){
        arrayEl = docValue[j];
        doc[key] = arrayEl;//set current array element as array property
        if (model.match(doc,query)){
          copy[key].push(arrayEl);
          doc[key] = docValue;//restore original array
          break;
        }
      }
    }
    else if (Array.isArray(docValue)){//we have array, apply projection on each element
      copy[key] = [];//initialize doc array
      j = docValue.length;
      while(j--){
        tmpDoc = Cursor.pick(docValue[j], keyValue, query);
        if (Object.keys(tmpDoc).length > 0) copy[key].unshift(tmpDoc);//use unshift because we are reverse browsing
      }
    }
    else{//simple embedded document
      tmpDoc = Cursor.pick(docValue,keyValue,query);
      if (Object.keys(tmpDoc).length > 0) copy[key] = tmpDoc;
    }
  }

  return copy;
};

/**
 * Return document properties except for the exluded ones.
 * Will also traverse through projection object with dot notation for embedded documents and arrays
 *
 * @param {Object} doc - The source doc from where data will be retrieved
 * @param {Object} projection - The projection doc based on which exclusion of properties will take place
 */
Cursor.omit = function(doc,projection){
  var copy = {};//object that will be returned to caller;
  var docKeys = Object.keys(doc);
  var i = docKeys.length;
  var key, projectValue,docValue, tmpDoc, j;
  while(i--){//browse doc properties
    key = docKeys[i];//get hold of current doc key
    //first we need to see if this property exists in projection. If not we should directly include it
    docValue = doc[key];//get hold of document value for current property key
    if (!projection.hasOwnProperty(key)){
      copy[key] = docValue;
      continue;//continue to next property
    }
    //it exists in projection, we should check
    projectValue = projection[key];
    if (!!projectValue && Array.isArray(docValue)){//we have document array, apply projection on each element
      copy[key] = [];//initialize copy array
      j = docValue.length;
      while (j--){
        tmpDoc = Cursor.omit(docValue[j],projectValue);
        if (Object.keys(tmpDoc).length > 0) copy[key].unshift(tmpDoc);//use unshift because we are reverse browsing
      }
    }
    else if(!!projectValue){//simple embedded document
      tmpDoc = Cursor.omit(docValue,projectValue);
      if (Object.keys(tmpDoc).length > 0) copy[key] = tmpDoc;
    }
  }

  return copy;
};
// Interface
module.exports = Cursor;
