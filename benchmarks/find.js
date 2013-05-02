var Datastore = require('../lib/datastore')
  , benchDb = 'workspace/find.bench.db'
  , fs = require('fs')
  , path = require('path')
  , async = require('async')
  , customUtils = require('../lib/customUtils')
  , d
  , n = 10000
  , order
  ;

if (process.argv[2]) { n = parseInt(process.argv[2], 10); }
order = customUtils.getRandomArray(n)

console.log("Benchmarking find");

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
, function (cb) {
    var beg = new Date()
      , i = 0;

    console.log("Finding " + n + " documents");

    function find(i) {
      if (i === n) {   // Finished
        var timeTaken = (new Date()).getTime() - beg.getTime();   // In ms
        console.log("Time taken: " + (timeTaken / 1000) + "s");
        console.log("Average time to find docs in a collection of " + n + " documents: " +  (timeTaken / n) + "ms");
        return cb();
      }

      d.find({ docNumber: order[i] }, function (err, docs) {
        if (docs.length !== 1 || docs[0].docNumber !== order[i]) { return cb('One find didnt work'); }
        process.nextTick(function () {
          find(i + 1);
        });
      });
    }
    find(0);
  }
], function (err) {
  console.log("Benchmark finished");

  if (err) { return console.log("An error was encountered: ", err); }
});
