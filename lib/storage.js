/**
 * Way data is stored for this database
 * For a Node.js/Node Webkit database it's the file system
 * For a browser-side database it's localStorage when supported
 *
 * This version is the Node.js/Node Webkit version
 */

var fs = require('fs')
  , mkdirp = require('mkdirp')
  ;


module.exports = fs;
module.exports.mkdirp = mkdirp;
