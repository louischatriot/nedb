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
        fs.readFile(self.filename, 'utf8', function (err, rawData) {
          if (err) { return callback(err); }
          self.data = Datastore.treatRawData(rawData);
          return callback();
        });
      }
    });
  });
};


/**
 * From a database's raw data, return the corresponding
 * machine understandable collection
 */
Datastore.treatRawData = function (rawData) {
  var data = rawData.split('\n')
    , res = [];

  data.forEach(function (d) {
    var doc;

    try {
      doc = JSON.parse(d);
      res.push(doc);
    } catch (e) {
    }
  });

  return res;
};



var d = new Datastore('workspace/test.db');
d.loadDatabase(function (err) {
});


