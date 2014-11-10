/**
 * Way data is stored for this database
 * For a Node.js/Node Webkit database it's the file system
 * For a browser-side database it's indexedDB
 *
 * This version has been tested with Chrome 38 and Firefox 33
 */

function getIndexedDBStore (dbName, storeName, cb) {
  var openreq = window.indexedDB.open(dbName, 1);

  openreq.onupgradeneeded = function (event) {
      var db = event.target.result;
      
      if (!db.objectStoreNames.contains(storeName)) {
          var store = db.createObjectStore(storeName, {key: '_id' });

          store.createIndex("_id", "_id", { unique: true })
      }
  };
  
  openreq.onsuccess = function(event) {
      var db = event.target.result;
     
      db.onversionchange = function (event) {
        db.close();
      };

      cb(null, db);
  };
}

function exists (filename, callback) {
  var request = window.indexedDB.open(filename, 1);
  var upNeeded = false;
  
  request.onupgradeneeded = function (e){
      e.target.transaction.abort();
      
      upNeeded = true;
      callback(false);
  };
  
  request.onsuccess = function (e) {
    e.target.result.close();
    
    if (!upNeeded) callback(true);
  };
}

function readAll (db, storeName, callback) {
  try {
    var trx = db.transaction([storeName], "readonly");
  
    trx.onerror = function () {
      callback ("Error reading the IndexedDB store");
    };
    
    var store = trx.objectStore(storeName);
    
    var request = store.openCursor();
  
    var objects = [];

    request.onsuccess = function(event) {
      var cursor = event.target.result;
      if(cursor) {
        objects.push(cursor.value);

        cursor.continue();
      } else {
        callback(null, objects);
      }
    };
  } catch (e) {
    callback (e);
  }
}

function replaceAll (db, storeName, objects, callback) {
  try {
    var trx1 = db.transaction([storeName], "readwrite");
  
    trx1.onerror = function () {
      callback ("Error replacing the IndexedDB store");
    };
    
    var store1 = trx1.objectStore(storeName);
    
    // clears the store in a separate thread, so we wait the onsuccess before putting the new objects
    store1.clear();

    trx1.oncomplete = function () {
      var trx2 = db.transaction([storeName], "readwrite");
      
      trx2.onerror = function () {
        callback ("Error replacing the IndexedDB store");
      };
      trx2.oncomplete = function () {
        // all done
        callback (null);
      };
      
      var store2 = trx2.objectStore(storeName);
      
      for (var i = 0; i < objects.length; i++) {
        
        if (!objects[i].$$indexCreated && !objects[i].$$indexRemoved) {
          // we won't store $$indexCreated or $$indexRemoved objects
          // also, the store was cleared so the $$deleted items can be ignored
          if (!store2.$$deleted) store2.put(objects[i], objects[i]._id);
        }
      }
    };
  } catch (e) {
    callback (e);
  }
}

function rename (filename, newFilename, callback) {
  getIndexedDBStore(filename, "objects", function (err, source) {
    readAll(source, "objects", function (err, sourceObjects) {
      if (err) return callback(err);
      
      source.close();
          
      getIndexedDBStore(newFilename, "objects", function (err, target) {
        if (err) return callback (err);
        
        replaceAll (target, "objects", sourceObjects, function (err) {
          if (err) return callback(err);
          
          target.close();
          
          callback();
        });
      });
    });
  });
}

function writeFile (filename, contents, options, callback) {
  if (typeof(options) === 'function') {
    callback = options;
  }

  var lines = contents.split("\n");
  var objects = [];
  
  for (var i = 0; i < lines.length; i++) {
    if (lines[i]) {
      // obviously, ignore empty lines
      objects.push(JSON.parse(lines[i]));
    }
  }
  
  getIndexedDBStore(filename, "objects", function (err, db) {
    if (err) return callback (err);
    
    replaceAll(db, "objects", objects, function (err) {
      if (err) return callback (err);
      
      db.close();
      
      callback();
    });
  });
}

function appendFile (filename, toAppend, options, callback) {
  var lines = toAppend.split('\n');
  var objects = [];
  
  for (var i = 0; i < lines.length; i++) {
    if (lines[i]) objects.push(JSON.parse(lines[i]));
  }
  
  getIndexedDBStore (filename, "objects", function (err, db) {
    if (err) return callback (err);
    
    try {
      var trx = db.transaction(["objects"], "readwrite");
      
      var store = trx.objectStore("objects");
      
      trx.oncomplete = function () {
        callback();
      };
    
      for (var i = 0; i < objects.length; i++) {
        if (!objects[i].$$indexCreated && !objects[i].$$indexRemoved) {
          // we won't store $$indexCreated or $$indexRemoved objects
          
          if (!objects[i].$$deleted) {
            store.put(objects[i], objects[i]._id);
          } else {
            store.delete(objects[i]._id);
          }
        }
      }
    } catch (e) {
      callback (e);
    }
  });
}


function readFile (filename, options, callback) {
  if (typeof(options) === 'function') {
    callback = options;
  }

  getIndexedDBStore(filename, "objects", function (err, db) {
    if (err) return callback (err);
    
    readAll (db, "objects", function (err, objects) {
      if (err) return callback (err);
      
      db.close();
      
      // rest of nedb takes this as a string, so it's a little bit inefficient doing this with lots of data
      var raw = "";
      
      for (var i = 0; i < objects.length; i++) {
        if (i) raw = '\n' + JSON.stringify(objects[i]);
        else raw = JSON.stringify(objects[i]);
      }
      
      callback (null, raw);
    });
  });
}

function unlink (filename, callback) {
  exists (filename, function (found) {
    if (found) {
      var deleteReq = window.indexedDB.deleteDatabase(filename);
      
      deleteReq.onerror = function () {
        callback('Error deleteing the database');
      };
      
      deleteReq.onsuccess = function() {
        callback();
      };
    } else {
        callback()
    }
  });
}

// Nothing done, no directories will be used on the browser
function mkdirp (dir, callback) {
  return callback();
}

// Interface
module.exports.exists = exists;
module.exports.rename = rename;
module.exports.writeFile = writeFile;
module.exports.appendFile = appendFile;
module.exports.readFile = readFile;
module.exports.unlink = unlink;
module.exports.mkdirp = mkdirp;
