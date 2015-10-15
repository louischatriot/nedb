/**
 * Way data is stored for this database
 * For a Node.js/Node Webkit database it's the file system
 * For a browser-side database it's localStorage when supported
 *
 * This version is the browser version
 */

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

  unlink:  function(filename, callback) {
    noopWarning();
    return callback();
  },

  mkdirp: function(dir, callback) {
    noopWarning();
    return callback();
  },
};

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

  unlink:  function(filename, callback) {
    localStorage.removeItem(filename);
    return callback();
  },

  mkdirp: function(dir, callback) {
    // Nothing done, no directories will be used on the browser
    return callback();
  },
};

if (typeof localStorage === 'undefined') {
  noopWarning();
  module.exports = noopInterface;
} else {
  module.exports = localStorageInterface;
}
