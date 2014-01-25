/**
 * Manage access to data, be it to find, update or remove it
 */
var model = require('./model');

 

/**
 * Create a new cursor for this collection
 * @param {Datastore} db - The datastore this cursor is bound to
 * @param {Query} query - The query this cursor will operate on
 */
function Cursor (db, query) {
  this.db = db;
  this.query = query;
}


/**
 * Set a limit the number of results
 */
Cursor.prototype.limit = function(limit) {
  this.limit = limit;
};


/**
 * Get all matching elements
 * @param {Function} callback - Signature: err, results
 */
 Cursor.prototype.exec = function(callback) {
  var candidates = this.db.getCandidates(this.query)
    , res = [], added = 0
    , i
    ;
  
  try {
    for (i = 0; i < candidates.length; i += 1) {
      if (model.match(candidates[i], this.query)) {
        res.push(model.deepCopy(candidates[i]));
        added += 1;
        if (this.limit && this.limit <= added) { break; }
      }
    }
  } catch (err) {
    return callback(err);
  }
  
  return callback(null, res);
};


// Interface
module.exports = Cursor;