var Datastore = require('../lib/datastore')
  , benchDb = 'workspace/insert.bench.db'
  , fs = require('fs')
  , path = require('path')
  , async = require('async')
  , customUtils = require('../lib/customUtils')
  , n = 10000
  , d
  ;

if (process.argv[2]) { n = parseInt(process.argv[2], 10); }

console.log("Benchmarking insert");

async.waterfall([
  function (cb) {
    console.log("Preparing database");

    customUtils.ensureDirectoryExists(path.dirname(benchDb), function () {
      fs.exists(benchDb, function (exists) {
        if (exists) {
          fs.unlink(benchDb, cb);
        } else { return cb(); }
      });
    });
  }
, function (cb) {
    d = new Datastore(benchDb);
    d.loadDatabase(cb);
  }
, function (cb) {
    var beg = new Date()
      , i = 0;

    console.log("Inserting " + n + " documents");

    function insertOne(i) {
      if (i === n) {   // Finished
        var timeTaken = (new Date()).getTime() - beg.getTime();   // In ms
        console.log("Time taken: " + (timeTaken / 1000) + "s");
        return cb();
      }

      d.insert({ docNumber: i }, function (err) {
        process.nextTick(function () {
          insertOne(i + 1);
        });
      });
    }
    insertOne(0);
  }
], function (err) {
  console.log("Benchmark finished");

  if (err) { return console.log("An error was encountered: ", err); }
});
