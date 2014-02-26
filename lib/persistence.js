/**
 * Handle every persistence-related task
 * The interface Datastore expects to be implemented is
 * * Persistence.loadDatabase(callback) and callback has signature err
 * * Persistence.persistNewState(newDocs, callback) where newDocs is an array of documents and callback has signature err
 */

var fs = require('fs')
  , path = require('path')
  , model = require('./model')
  , async = require('async')
  , mkdirp = require('mkdirp')
  , customUtils = require('./customUtils')
  , Index = require('./indexes')
  ;


/**
 * Create a new Persistence object for database options.db
 * @param {Datastore} options.db
 * @param {Boolean} options.nodeWebkitAppName Optional, specify the name of your NW app if you want options.filename to be relative to the directory where
 *                                            Node Webkit stores application data such as cookies and local storage (the best place to store data in my opinion)
 */
function Persistence (options) {
  this.db = options.db;
  this.inMemoryOnly = this.db.inMemoryOnly;
  this.filename = this.db.filename;
  
  if (!this.inMemoryOnly && this.filename) {
    if (this.filename.charAt(this.filename.length - 1) === '~') {
      throw "The datafile name can't end with a ~, which is reserved for automatic backup files";
    } else {
      this.tempFilename = this.filename + '~';
      this.oldFilename = this.filename + '~~';
    }
  }

  // For NW apps, store data in the same directory where NW stores application data
  if (this.filename && options.nodeWebkitAppName) {
    console.log("==================================================================");
    console.log("WARNING: The nodeWebkitAppName option is deprecated");
    console.log("To get the path to the directory where Node Webkit stores the data");
    console.log("for your app, use the internal nw.gui module like this");
    console.log("require('nw.gui').App.dataPath");
    console.log("See https://github.com/rogerwang/node-webkit/issues/500");
    console.log("==================================================================");
    this.filename = Persistence.getNWAppFilename(options.nodeWebkitAppName, this.filename);
    this.tempFilename = Persistence.getNWAppFilename(options.nodeWebkitAppName, this.tempFilename);
    this.oldFilename = Persistence.getNWAppFilename(options.nodeWebkitAppName, this.oldFilename);
  }
};


/**
 * Check if a directory exists and create it on the fly if it is not the case
 * cb is optional, signature: err
 */
Persistence.ensureDirectoryExists = function (dir, cb) {
  var callback = cb || function () {}
    ;

  mkdirp(dir, function (err) { return callback(err); });
};


/**
 * Return the path the datafile if the given filename is relative to the directory where Node Webkit stores
 * data for this application. Probably the best place to store data
 */
Persistence.getNWAppFilename = function (appName, relativeFilename) {
  var home;

  switch (process.platform) {
    case 'win32':
    case 'win64':
      home = process.env.LOCALAPPDATA || process.env.APPDATA;
      if (!home) { throw "Couldn't find the base application data folder"; }
      home = path.join(home, appName);
      break;
    case 'darwin':
      home = process.env.HOME;
      if (!home) { throw "Couldn't find the base application data directory"; }
      home = path.join(home, 'Library', 'Application Support', appName);
      break;
    case 'linux':
      home = process.env.HOME;
      if (!home) { throw "Couldn't find the base application data directory"; }
      home = path.join(home, '.config', appName);
      break;
    default:
      throw "Can't use the Node Webkit relative path for platform " + process.platform;
      break;
  }

  return path.join(home, 'nedb-data', relativeFilename);
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
    , self = this
    ;

  if (this.inMemoryOnly) { return callback(null); } 

  this.db.getAllData().forEach(function (doc) {
    toPersist += model.serialize(doc) + '\n';
  });
  Object.keys(this.db.indexes).forEach(function (fieldName) {
    if (fieldName != "_id") {   // The special _id index is managed by datastore.js, the others need to be persisted
      toPersist += model.serialize({ $$indexCreated: { fieldName: fieldName, unique: self.db.indexes[fieldName].unique, sparse: self.db.indexes[fieldName].sparse }}) + '\n';
    }
  });

  async.waterfall([
    async.apply(customUtils.ensureFileDoesntExist, self.tempFilename)
  , async.apply(customUtils.ensureFileDoesntExist, self.oldFilename)
  , function (cb) {
      fs.exists(self.filename, function (exists) {
        if (exists) {
          fs.rename(self.filename, self.oldFilename, function (err) { return cb(err); });
        } else {
          return cb();
        }
      });  
  }
  , function (cb) {
      fs.writeFile(self.tempFilename, toPersist, function (err) { return cb(err); });
    }
  , function (cb) {
      fs.rename(self.tempFilename, self.filename, function (err) { return cb(err); });
    }
  , async.apply(customUtils.ensureFileDoesntExist, self.oldFilename)
  ], function (err) { if (err) { return callback(err); } else { return callback(null); } })
};


/**
 * Queue a rewrite of the datafile
 */
Persistence.prototype.compactDatafile = function () {
  this.db.executor.push({ this: this, fn: this.persistCachedDatabase, arguments: [] });
};


/**
 * Set automatic compaction every interval ms
 * @param {Number} interval in milliseconds, with an enforced minimum of 5 seconds
 */
Persistence.prototype.setAutocompactionInterval = function (interval) {
  var self = this
    , minInterval = 5000
    , realInterval = Math.max(interval || 0, minInterval)
    ;

  this.stopAutocompaction();

  this.autocompactionIntervalId = setInterval(function () {
    self.compactDatafile();
  }, realInterval);
};


/**
 * Stop autocompaction (do nothing if autocompaction was not running)
 */
Persistence.prototype.stopAutocompaction = function () {
  if (this.autocompactionIntervalId) { clearInterval(this.autocompactionIntervalId); }
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
  if (self.inMemoryOnly) { return callback(null); }

  newDocs.forEach(function (doc) {
    toPersist += model.serialize(doc) + '\n';
  });

  if (toPersist.length === 0) { return callback(null); }

  fs.appendFile(self.filename, toPersist, 'utf8', function (err) {
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
 * Ensure that this.filename contains the most up-to-date version of the data
 * Even if a loadDatabase crashed before
 */
Persistence.prototype.ensureDatafileIntegrity = function (callback) {
  var self = this  ;

  fs.exists(self.filename, function (filenameExists) {
    // Write was successful
    if (filenameExists) { return callback(null); }
  
    fs.exists(self.oldFilename, function (oldFilenameExists) {
      // New database
      if (!oldFilenameExists) {
        return fs.writeFile(self.filename, '', 'utf8', function (err) { callback(err); });            
      }
    
      // Write failed, use old version
      fs.rename(self.oldFilename, self.filename, function (err) { return callback(err); });
    });
  });
};


/**
 * Load the database
 * 1) Create all indexes
 * 2) Insert all data
 * 3) Compact the database
 * This means pulling data out of the data file or creating it if it doesn't exist
 * Also, all data is persisted right away, which has the effect of compacting the database file
 * This operation is very quick at startup for a big collection (60ms for ~10k docs)
 * @param {Function} cb Optional callback, signature: err
 */
Persistence.prototype.loadDatabase = function (cb) {
  var callback = cb || function () {}
    , self = this
    ;

  self.db.resetIndexes();

  // In-memory only datastore
  if (self.inMemoryOnly) { return callback(null); }

  async.waterfall([
    function (cb) {
      Persistence.ensureDirectoryExists(path.dirname(self.filename), function (err) {
        self.ensureDatafileIntegrity(function (exists) {
          fs.readFile(self.filename, 'utf8', function (err, rawData) {
            if (err) { return cb(err); }
            var treatedData = Persistence.treatRawData(rawData);

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
