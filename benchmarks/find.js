var Datastore = require('../lib/datastore')
  , benchDb = 'workspace/find.bench.db'
  , fs = require('fs')
  , path = require('path')
  , async = require('async')
  , customUtils = require('../lib/customUtils')
  , d
  , order = customUtils.getRandomArray(10000)
  ;

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

    console.log("Inserting 10,000 documents");

    async.whilst( function () { return i < 10000; }
    , function (_cb) {
      i += 1;
      d.insert({ docNumber: i }, function (err) {
        return _cb(err);
      });
    }, function (err) {
      var timeTaken = (new Date()).getTime() - beg.getTime();   // In ms
      if (err) { return cb(err); }
      console.log("Time taken: " + (timeTaken / 1000) + "s");
      return cb();
    });
  }
, function (cb) {
    var beg = new Date()
      , i = 0;

    console.log("Finding 10,000 documents");

    async.whilst( function () { return i < 10000; }
    , function (_cb) {
      i += 1;
      d.find({ docNumber: order[i] }, function (err, docs) {
        if (docs.length !== 1) { return _cb('Strangely, the doc was not found'); }
        return _cb(err);
      });
    }, function (err) {
      var timeTaken = (new Date()).getTime() - beg.getTime();   // In ms
      if (err) { return cb(err); }
      console.log("Time taken: " + (timeTaken / 1000) + "s");
      return cb();
    });
  }
], function (err) {
  console.log("Benchmark finished");

  if (err) { return console.log("An error was encountered: ", err); }
});
