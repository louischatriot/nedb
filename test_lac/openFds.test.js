var fs = require('fs')
  , child_process = require('child_process')
  , async = require('async')
  , Nedb = require('../lib/datastore')
  , db = new Nedb({ filename: './workspace/openfds.db', autoload: true })
  , N = 64   // Half the allowed file descriptors
  , i, fds
  ;

function multipleOpen (filename, N, callback) {
  async.whilst( function () { return i < N; }
              , function (cb) {
                fs.open(filename, 'r', function (err, fd) {
                  i += 1;
                  if (fd) { fds.push(fd); }
                  return cb(err);
                });
              }
              , callback);
}

async.waterfall([
  // Check that ulimit has been set to the correct value
  function (cb) {
    i = 0;
    fds = [];
    multipleOpen('./test_lac/openFdsTestFile', 2 * N + 1, function (err) {
      if (!err) { console.log("No error occured while opening a file too many times"); }
      fds.forEach(function (fd) { fs.closeSync(fd); });
      return cb();
    })
  }
, function (cb) {
    i = 0;
    fds = [];
    multipleOpen('./test_lac/openFdsTestFile2', N, function (err) {
      if (err) { console.log('An unexpected error occured when opening file not too many times: ' + err); }
      fds.forEach(function (fd) { fs.closeSync(fd); });
      return cb();
    })
  }
  // Then actually test NeDB persistence
, function () {
    db.remove({}, { multi: true }, function (err) {
      if (err) { console.log(err); }
      db.insert({ hello: 'world' }, function (err) {
        if (err) { console.log(err); }

        i = 0;
        async.whilst( function () { return i < 2 * N  + 1; }
                    , function (cb) {
                        db.persistence.persistCachedDatabase(function (err) {
                          if (err) { return cb(err); }
                          i += 1;
                          return cb();
                        });
                      }
                    , function (err) {
                      if (err) { console.log("Got unexpected error during one peresistence operation: " + err); }
                      }
                    );

      });
    });
  }
]);

