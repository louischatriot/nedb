var Datastore = require('../lib/datastore')
  , benchDb = 'workspace/insert.bench.db'
  , async = require('async')
  , commonUtilities = require('./commonUtilities')
  , execTime = require('exec-time')
  , profiler = new execTime('INSERT BENCH')
  , n = 10000
  , d = new Datastore(benchDb)
  ;

if (process.argv[2]) { n = parseInt(process.argv[2], 10); }

async.waterfall([
  async.apply(commonUtilities.prepareDb, benchDb)
, function (cb) {
    d.loadDatabase(cb);
  }
, function (cb) { profiler.beginProfiling(); return cb(); }
, async.apply(commonUtilities.insertDocs, d, n, profiler)
], function (err) {
  profiler.step("Benchmark finished");

  if (err) { return console.log("An error was encountered: ", err); }
});
