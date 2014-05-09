/**
 * Handle every persistence-related task
 * The interface Datastore expects to be implemented is
 * * Persistence.loadDatabase(callback) and callback has signature err
 * * Persistence.persistNewState(newDocs, callback) where newDocs is an array of documents and callback has signature err
 */

var Index = require('./indexes');

/**
 * Create a new Persistence object for database options.db
 * For now, no browser persistence supported, in-memory only mode forced
 * @param {Datastore} options.db
 */
function Persistence (options) {
  this.db = options.db;
  this.db.inMemoryOnly = false;
  this.inMemoryOnly = false;
  this.inBrowser = true;
};

Persistence.prototype.getLocalStorageData = function(){
   var key = this.db.filename,
      localData = localStorage.getItem(key),
      array = JSON.parse(localData);

   return array;
};

Persistence.prototype.setLocalStorageData = function(dataArray){
   var key = this.db.filename,
      storeContent = JSON.stringify(dataArray);

   localStorage.setItem(key, storeContent);
};

Persistence.prototype.persistNewState = function (newDocs, cb) {
   var currentData = this.getLocalStorageData() || [];

   for(var doc in newDocs){
      currentData.push(newDocs[doc]);
   }

   this.setLocalStorageData(currentData);

   if (cb) { return cb(); }
};

/**
 * Queue a rewrite of the datafile
 */
Persistence.prototype.compactDatafile = function () {
   this.db.executor.push({ this: this, fn: this.persistCachedDatabase, arguments: [] });
};

/**
 * Persist cached database
 * This serves as a compaction function since the cache always contains only the number of documents in the collection
 * while the data file is append-only so it may grow larger
 * @param {Function} cb Optional callback, signature: err
 */
Persistence.prototype.persistCachedDatabase = function (cb) {
   var callback = cb || function () {}
      , toPersist = []
      , self = this
      ;

   this.db.getAllData().forEach(function (doc) {
      toPersist.push(doc);
   });

   Object.keys(this.db.indexes).forEach(function (fieldName) {
      if (fieldName != "_id") {   // The special _id index is managed by datastore.js, the others need to be persisted
         toPersist.push({ $$indexCreated: { fieldName: fieldName, unique: self.db.indexes[fieldName].unique, sparse: self.db.indexes[fieldName].sparse }});
      }
   });

   this.setLocalStorageData(toPersist);

   if (cb) { return cb(); }
};

/**
 * From a database's raw data, return the corresponding
 * machine understandable collection
 */
Persistence.treatRawData = function (rawData) {
   var data = rawData
      , dataById = {}
      , tdata = []
      , i
      , indexes = {}
      ;

   for (i = 0; i < data.length; i += 1) {
      var doc;

      try {
         doc = data[i];
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

Persistence.prototype.loadDatabase = function (cb) {
   var self = this;

   var data = this.getLocalStorageData();

   this.loadData(data, cb);
};

// Interface
module.exports = Persistence;