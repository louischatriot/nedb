/**
 * The datastore itself
 */

var fs = require('fs')
  , path = require('path')
  , customUtils = require('./customUtils')
  ;


/**
 * Create a new collection
 */
function Datastore (filename) {
  this.filename = filename;
  this.data = [];
}


/**
 * Load the database
 * For now this means pulling data out of the data file or creating it
 * if it doesn't exist
 * @param {Function} cb Optional callback, signature: err
 */
Datastore.prototype.loadDatabase = function (cb) {
  var callback = cb || function () {}
    , self = this
    ;

  customUtils.ensureDirectoryExists(path.dirname(self.filename), function (err) {
    fs.exists(self.filename, function (exists) {
      if (!exists) {
        self.data = [];
        fs.writeFile(self.filename, '', 'utf8', function (err) { return callback(err); });
      } else {
        fs.readFile(self.filename, 'utf8', function (err, data) {
          if (err) { return callback(err); }
          self.data = data;
          return callback();
        });
      }
    });
  });
};





var d = new Datastore('workspace/test.db');
d.loadDatabase(function (err) {
  console.log("====");
  console.log(err);
  console.log(d.data);
});


