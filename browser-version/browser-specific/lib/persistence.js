/**
 * Handle every persistence-related task
 * The interface Datastore expects to be implemented is
 * * Persistence.loadDatabase(callback) and callback has signature err
 * * Persistence.persistNewState(newDocs, callback) where newDocs is an array of documents and callback has signature err
 *
 * Shim for the browser
 */

/**
 * Create a new Persistence object for database options.db
 * For now, no browser persistence supported, in-memory only mode forced
 * @param {Datastore} options.db
 */
function Persistence (options) {
  this.db = options.db;
  this.db.inMemoryOnly = true;
  this.db.filename = null;
  this.inMemoryOnly = true;
};


/**
 * No persistence in the browser (for now)
 */
Persistence.prototype.persistNewState = function (newDocs, cb) {
  if (cb) { return cb(); }
};


/**
 * No persistence in the browser (for now)
 */
Persistence.prototype.loadDatabase = function (cb) {
  if (cb) { return cb(); }
};


// Interface
module.exports = Persistence;
