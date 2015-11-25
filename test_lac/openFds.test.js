var fs = require('fs')
  , child_process = require('child_process')
  , async = require('async')
  , N = 64   // One file descriptor too many
  , i =0
  ;

function multipleOpen (filename, N, callback) {
  async.whilst( function () { return i < N; }
              , function (cb) {
                fs.open(filename, 'r', function (err, fd) {
                  i += 1;
                  return cb(err);
                });
              }
              , callback);
}


async.waterfall([
  function (cb) {
    multipleOpen('./test_lac/openFdsTestFile', 2 * N + 1, function (err) {
      if (!err) { console.log("No error occured while opening a file too many times"); }
      return cb();
    })
  }
, function (cb) {
    multipleOpen('./test_lac/openFdsTestFile2', N, function (err) {
      if (err) { console.log('An unexpected error occured when opening file not too many times: ' + err); }
    })
  }
]);
