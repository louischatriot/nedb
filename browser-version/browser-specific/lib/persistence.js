/**
 * Handle every persistence-related task
 * The interface Datastore expects to be implemented is
 * * Persistence.loadDatabase(callback) and callback has signature err
 * * Persistence.persistNewState(newDocs, callback) where newDocs is an array of documents and callback has signature err
 *
 * Shim for the browser
 */


var model = require('./model')
  , Index = require('./indexes')
  ;
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
 * From a database's raw data, return the corresponding
 * machine understandable collection
 */
Persistence.treatRawData = function (rawData) {
  var data = rawData.split('\n')
    , dataById = {}
    , tdata = []
    , i
    , indexes = {}
    ;

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
      } else if (doc.$$indexCreated && doc.$$indexCreated.fieldName != undefined) {
        indexes[doc.$$indexCreated.fieldName] = doc.$$indexCreated;
      } else if (typeof doc.$$indexRemoved === "string") {
        delete indexes[doc.$$indexRemoved];
      }
    } catch (e) {
    }
  }

  Object.keys(dataById).forEach(function (k) {
    tdata.push(dataById[k]);
  });

  return { data: tdata, indexes: indexes };
};



/**
 * Load Data from String
 */
Persistence.prototype.loadString = function(data,cb) {
   var callback = cb || function () {}
    , self = this
    ;

    self.db.resetIndexes();
    return self.loadData(data,cb);
};

/**
 * Load Database Data
 */
Persistence.prototype.loadData = function(data,cb) {
  var callback = cb || function () {}
    , self = this
    ;

  var treatedData = Persistence.treatRawData(data);

  // Recreate all indexes in the datafile
  Object.keys(treatedData.indexes).forEach(function (key) {
    self.db.indexes[key] = new Index(treatedData.indexes[key]);
  });
            
  // Fill cached database (i.e. all indexes) with data
  try {
    self.db.resetIndexes(treatedData.data);
  } catch (e) {
    self.db.resetIndexes();   // Rollback any index which didn't fail
    return cb(e);
  }

  self.db.executor.processBuffer();
  return cb(null);
};

// Interface
module.exports = Persistence;
