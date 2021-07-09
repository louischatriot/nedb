/**
 * Way data is stored for this database
 * For a Node.js/Node Webkit database it's the file system
 * For a browser-side database it's localforage which chooses the best option depending on user browser (IndexedDB then WebSQL then localStorage)
 *
 * This version is the Node.js/Node Webkit version
 * It's essentially fs, mkdirp and crash safe write and read functions
 */

var storage = {};

/**
 *  variable holding our app's data folder. This is where our nedb database file will be stored
 */  
var localFolder = Windows.Storage.ApplicationData.current.localFolder;

/** 
 * exists for WinJS
 */
storage.exists = function (filename, callback) {
	localFolder.getFileAsync(filename).then(
		function (file) { 
			/* file exists. return true */ 
			return callback(true); 
		}, 
		function (err) { 
			/* no file was found. return false */ 
			return callback(false); 
		}
	);
}

/**
 * rename for WinJS
 */
storage.rename = function (filename, newFilename, callback) {
	localFolder.getFileAsync(filename).then(
		function (file) {
			/* file exists. rename */
			file.renameAsync(newFilename, Windows.Storage.NameCollisionOption.replaceExisting).done(
				function (){ /* file found and deleted */ return callback(); }, 
				function (err){ return callback(err); }
			);
		}, function (err) {
			//no file was found
			return callback(err);
		}
	);
}

/**
 * writeFile for WinJS
 */
storage.writeFile = function (filename, contents, options, callback) {
	// TODO: add options. for now we just skip, as in the browser version
	if (typeof options === 'function') { callback = options; } 
  
	localFolder.createFileAsync(filename, Windows.Storage.CreationCollisionOption.replaceExisting).then(
		function(file){
			Windows.Storage.FileIO.writeTextAsync(file, contents).then(
				function () {
					return callback();
				},                      
				function (err) {
					return callback(err)
				}
			);		
		},                      
		function (err) {
			return callback(err)
		}
	);
}


/**
 * appendFile for WinJS
 */
storage.appendFile = function (filename, contents, options, callback) {
	// TODO: add options. for now we just skip, as in the browser version
	if (typeof options === 'function') { callback = options; }
  
	localFolder.getFileAsync(filename).then(
		function (file) {
			Windows.Storage.FileIO.appendTextAsync(file, contents).done(
				function(){ 
					return callback() 
				}, 
				function (err) { 
					return callback(err); 
				}
			);
		},                      
		function (err) {
			return callback(err)
		}
	); 
}


/**
 * appendFile for WinJS
 */
storage.mkdirp = function (dir, callback) {
  // there's no mkdrip for winJS, but we store everything in the localFolder
  // users should only supply a database name for now, no path
  return callback();
}


/** 
 * readFile for WinJS
 */
storage.readFile = function(filename, options, callback)
{
	// TODO: add options. for now we just skip, as in the browser version
    if (typeof options === 'function') { callback = options; }
  
	localFolder.getFileAsync(filename).then(
		function (file) {
			// read file
			Windows.Storage.FileIO.readTextAsync(file).then(
				function (contents) {
					return callback(null, contents || '');
				}, function (err) {
					return callback(err);
				}
			);
		}, function (err) {
			//no file was found
			return callback(err);
		}
	);
}


/** 
 * Unlink for WinJS
 */
storage.unlink = function (filename, callback) {
	localFolder.getFileAsync(filename).then(
		function (file) {
			file.deleteAsync().then(
				function (){ 
					/* file found and deleted */ 
					return callback(true); 
				}, 
				function (err){ 
					/* error */ 
					return callback(err); 
				}
			);
		}, 
		function (err){ 
			/* error */ 
			return callback(err); 
		}
	);
}

/**
 * Explicit name ...
 */
storage.ensureFileDoesntExist = function (filename, callback) {
	
	storage.exists(filename, function (exists) {
		if (!exists) { return callback(null); }

		storage.unlink(filename, function (err) { return callback(err); });
	});
};


/**
 * Flush data in OS buffer to storage if corresponding option is set
 * @param {String} options.filename
 * @param {Boolean} options.isDir Optional, defaults to false
 * If options is a string, it is assumed that the flush of the file (not dir) called options was requested
 */
storage.flushToStorage = function (options, callback) {
	// as in the case outlined below, there's no fsync in windows. 
	// and because it's winJS, we know we're in windows. 	
	return callback(null); 
	
  // var filename, flags;
  // if (typeof options === 'string') {
    // filename = options;
    // flags = 'r+';
  // } else {
    // filename = options.filename;
    // flags = options.isDir ? 'r' : 'r+';
  // }

  // // Windows can't fsync (FlushFileBuffers) directories. We can live with this as it cannot cause 100% dataloss
  // // except in the very rare event of the first time database is loaded and a crash happens
  // if (flags === 'r' && (process.platform === 'win32' || process.platform === 'win64')) { return callback(null); }

  // fs.open(filename, flags, function (err, fd) {
    // if (err) { return callback(err); }
    // fs.fsync(fd, function (errFS) {
      // fs.close(fd, function (errC) {
        // if (errFS || errC) {
          // var e = new Error('Failed to flush to storage');
          // e.errorOnFsync = errFS;
          // e.errorOnClose = errC;
          // return callback(e);
        // } else {
          // return callback(null);
        // }
      // });
    // });
  // });
};

 
/**
 * Fully write or rewrite the datafile, immune to crashes during the write operation (data will not be lost)
 * @param {String} filename
 * @param {String} data
 * @param {Function} cb Optional callback, signature: err
 */
storage.crashSafeWriteFile = storage.writeFile; 
// I'm skipping this for now because I'm not a very good coder. 
// storage.crashSafeWriteFile = function (filename, data, cb) {
  // var callback = cb || function () {}
    // , tempFilename = filename + '~';

  // async.waterfall([
    // async.apply(storage.flushToStorage, { filename: path.dirname(filename), isDir: true })
  // , function (cb) {
      // storage.exists(filename, function (exists) {
        // if (exists) {
          // storage.flushToStorage(filename, function (err) { return cb(err); });
        // } else {
          // return cb();
        // }
      // });
    // }
  // , function (cb) {
      // storage.writeFile(tempFilename, data, function (err) { return cb(err); });
    // }
  // , async.apply(storage.flushToStorage, tempFilename)
  // , function (cb) {
      // storage.rename(tempFilename, filename, function (err) { return cb(err); });
    // }
  // , async.apply(storage.flushToStorage, { filename: path.dirname(filename), isDir: true })
  // ], function (err) { return callback(err); })
// };


/**
 * Ensure the datafile contains all the data, even if there was a crash during a full file write
 * @param {String} filename
 * @param {Function} callback signature: err
 */
storage.ensureDatafileIntegrity = function (filename, callback) {
  var tempFilename = filename + '~';

  storage.exists(filename, function (filenameExists) {
    // Write was successful
    if (filenameExists) { return callback(null); }

    storage.exists(tempFilename, function (oldFilenameExists) {
      // New database
      if (!oldFilenameExists) {
        return storage.writeFile(filename, '', 'utf8', function (err) { callback(err); });
      }

      // Write failed, use old version
      storage.rename(tempFilename, filename, function (err) { return callback(err); });
    });
  });
};



// Interface
module.exports = storage;
