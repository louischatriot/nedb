/**
 * Way data is stored for this database
 * For a Node.js/Node Webkit database it's the file system
 * For a browser-side database it's localStorage when supported
 *
 * This version is the Node.js/Node Webkit version
 */



function exists (filename, callback) {
  // In this specific case this always answers that the file doesn't exist
  if (typeof localStorage === 'undefined') { console.log("WARNING - This browser doesn't support localStorage, no data will be saved in NeDB!"); return callback(); }

  if (localStorage.getItem(filename) !== null) {
    return callback(true);
  } else {
    return callback(false);
  }
}


function rename (filename, newFilename, callback) {
  if (typeof localStorage === 'undefined') { console.log("WARNING - This browser doesn't support localStorage, no data will be saved in NeDB!"); return callback(); }

  if (localStorage.getItem(filename) === null) {
    localStorage.removeItem(newFilename);
  } else {
    localStorage.setItem(newFilename, localStorage.getItem(filename));
    localStorage.removeItem(filename);
  }

  return callback();
}


function writeFile (filename, contents, options, callback) {
  if (typeof localStorage === 'undefined') { console.log("WARNING - This browser doesn't support localStorage, no data will be saved in NeDB!"); return callback(); }
  
  // Options do not matter in browser setup
  if (typeof options === 'function') { callback = options; }

  localStorage.setItem(filename, contents);
  return callback();
}


function appendFile (filename, toAppend, options, callback) {
  if (typeof localStorage === 'undefined') { console.log("WARNING - This browser doesn't support localStorage, no data will be saved in NeDB!"); return callback(); }
  
  // Options do not matter in browser setup
  if (typeof options === 'function') { callback = options; }

  var contents = localStorage.getItem(filename) || '';
  contents += toAppend;

  localStorage.setItem(filename, contents);
  return callback();
}


function readFile (filename, options, callback) {
  if (typeof localStorage === 'undefined') { console.log("WARNING - This browser doesn't support localStorage, no data will be saved in NeDB!"); return callback(); }
  
  // Options do not matter in browser setup
  if (typeof options === 'function') { callback = options; }

  var contents = localStorage.getItem(filename) || '';
  return callback(null, contents);
}


function unlink (filename, callback) {
  if (typeof localStorage === 'undefined') { console.log("WARNING - This browser doesn't support localStorage, no data will be saved in NeDB!"); return callback(); }

  localStorage.removeItem(filename);
  return callback();
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

