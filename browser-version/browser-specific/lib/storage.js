/**
 * Way data is stored for this database
 * For a Node.js/Node Webkit database it's the file system
 * For a browser-side database it's:
 *  - IndexedDB when supported or
 *  - localStorage when supported or
 *  - noopStorage (do not save anything)
 *
 * This version is the browser version
 */

 // # noop Interface

var noopWarning = function() {
  console.log("WARNING - This browser doesn't support any storage, no data will be saved in NeDB!");
};

var noopInterface = {

  exists: function(filename, callback) {
    noopWarning();
    return callback();
  },

  rename: function(filename, newFilename, callback) {
    noopWarning();
    return callback();
  },

  writeFile: function(filename, contents, options, callback) {
    noopWarning();
    return callback();
  },

  appendFile: function(filename, toAppend, options, callback) {
    noopWarning();
    return callback();
  },

  readFile: function(filename, options, callback) {
    noopWarning();
    return callback();
  },

  unlink: function(filename, callback) {
    noopWarning();
    return callback();
  },

  mkdirp: function(dir, callback) {
    noopWarning();
    return callback();
  },
};

// # local storage Interface

var localStorageInterface = {

  exists: function(filename, callback) {
    if (localStorage.getItem(filename) !== null) {
      return callback(true);
    } else {
      return callback(false);
    }
  },

  rename: function(filename, newFilename, callback) {
    if (localStorage.getItem(filename) === null) {
      localStorage.removeItem(newFilename);
    } else {
      localStorage.setItem(newFilename, localStorage.getItem(filename));
      localStorage.removeItem(filename);
    }

    return callback();
  },

  writeFile: function(filename, contents, options, callback) {
    // Options do not matter in browser setup
    if (typeof options === 'function') { callback = options; }

    localStorage.setItem(filename, contents);
    return callback();
  },

  appendFile: function(filename, toAppend, options, callback) {
    // Options do not matter in browser setup
    if (typeof options === 'function') { callback = options; }

    var contents = localStorage.getItem(filename) || '';
    contents += toAppend;

    localStorage.setItem(filename, contents);
    return callback();
  },

  readFile: function(filename, options, callback) {
    // Options do not matter in browser setup
    if (typeof options === 'function') { callback = options; }

    var contents = localStorage.getItem(filename) || '';
    return callback(null, contents);
  },

  unlink: function(filename, callback) {
    localStorage.removeItem(filename);
    return callback();
  },

  mkdirp: function(dir, callback) {
    // Nothing done, no directories will be used on the browser
    return callback();
  },
};

// # IndexedDB Interface

var db;

var getIndexedDB = function(callback) {
  if (db) {
    return callback(null, db);
  }

  var request = indexedDB.open('NeDB');
  request.onerror = function(event) {
    callback(new Error('IndexedDB open error: ' + event.target.errorCode));
  };

  request.onsuccess = function(event) {
    db = event.target.result;
    callback(null, db);
  };

  request.onupgradeneeded = function(event) {
    var db = event.target.result;

    var objectStore = db.createObjectStore('files');

    objectStore.transaction.oncomplete = function(event) {
      // console.log('database created');
    };
  };
};

var getIndexedDBFileStore = function(writable, callback) {
  getIndexedDB(function(err, db) {
    if (err) {
      return callback(err);
    }

    var mode = 'readonly';
    if (writable) {
      mode = 'readwrite';
    }

    var transaction = db.transaction(['files'], mode);
    var fileStore = transaction.objectStore('files');
    callback(null, fileStore);
  });
};

var indexedDBInterface = {

  exists: function(filename, callback) {
    this.readFile(filename, {}, function(err) {
      if (err) {
        callback(false);
      } else {
        callback(true);
      }
    });
  },

  rename: function(filename, newFilename, callback) {
    var _this = this;
    _this.readFile(filename, function(err, contents) {
      if (err) {
        return callback(err);
      }

      _this.writeFile(newFilename, contents, {}, function(err) {
        if (err) {
          return callback(err);
        }

        _this.unlink(filename, callback);
      });
    });
  },

  writeFile: function(filename, contents, options, callback) {
    // Options do not matter in browser setup
    if (typeof options === 'function') { callback = options; }

    getIndexedDBFileStore(true, function(err, fileStore) {
      if (err) {
        return callback(err);
      }

      var request = fileStore.put(contents, filename);
      request.onerror = function(event) {
        callback(new Error('IndexedDB write error: ' + event.target.errorCode));
      };

      request.onsuccess = function(event) {
        callback();
      };
    });
  },

  appendFile: function(filename, toAppend, options, callback) {
    // Options do not matter in browser setup
    if (typeof options === 'function') { callback = options; }

    var _this = this;
    _this.readFile(filename, {}, function(err, contents) {
      if (err) {
        return callback(err);
      }

      contents = contents || '';
      contents += toAppend;

      _this.writeFile(filename, contents, {}, callback);
    });
  },

  readFile: function(filename, options, callback) {
    // Options do not matter in browser setup
    if (typeof options === 'function') { callback = options; }

    getIndexedDBFileStore(false, function(err, fileStore) {
      if (err) {
        return callback(err);
      }

      var request = fileStore.get(filename);
      request.onerror = function(event) {
        callback(new Error('IndexedDB get error: ' + event.target.errorCode));
      };

      request.onsuccess = function(event) {
        callback(null, event.target.result || '');
      };
    });
  },

  unlink: function(filename, callback) {
    getIndexedDBFileStore(true, function(err, fileStore) {
      if (err) {
        return callback(err);
      }

      var request = fileStore.delete(filename);
      request.onerror = function(event) {
        callback(new Error('IndexedDB delete error: ' + event.target.errorCode));
      };

      request.onsuccess = function(event) {
        callback();
      };
    });
  },

  mkdirp: function(dir, callback) {
    return callback();
  },
};

// TODO: change the storage module to export a factory and construct
//       the specific storage based on the options passed to the factory.
//       meanwhile you can set:
//         window.nedbSkipIndexedDB = true;
//         window.nedbSkipLocalStorage = true;
//       to skip a specific storage. Note that this flags has to bee set before
//       nedb is loaded.
if (typeof indexedDB !== 'undefined' && !window.nedbSkipIndexedDB) {
  module.exports = indexedDBInterface;
} else if (typeof localStorage !== 'undefined' && !window.nedbSkipLocalStorage) {
  module.exports = localStorageInterface;
} else {
  noopWarning();
  module.exports = noopInterface;
}
